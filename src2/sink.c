//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

#include "sink.h"
#include <stdio.h>
#include <time.h>

#if defined(SINK_POSIX)
#	define __USE_GNU
#	include <string.h>
#	undef __USE_GNU
#else
#	include <string.h>
#endif

#if defined(SINK_MAC) || defined(SINK_POSIX)
#	include <strings.h>  // ffsll
#	define BITSCAN_FFSLL
#else
#	include <intrin.h>   // _BitScanForward64, _BitScanReverse
#	define BITSCAN_WIN
#endif

// internal representation of a string
typedef struct {
	uint8_t *bytes;
	int size;
} str_st;

// internal representation of a list
typedef struct {
	sink_val *vals;
	void *user;
	int size;
	int count;
	sink_user usertype;
} list_st;

#ifdef SINK_DEBUG
#	ifdef NDEBUG
#		undef NDEBUG
#	endif
#	include <assert.h>
#	define debug(msg)         fprintf(stderr, "> %-10s: %s\n", __func__, msg)
#	define debugf(msg, ...)   fprintf(stderr, "> %-10s: " msg "\n", __func__, __VA_ARGS__)
#	define oplog(msg)         fprintf(stderr, "%% %s\n", msg)
#	define oplogf(msg, ...)   fprintf(stderr, "%% " msg "\n", __VA_ARGS__)
#else
#	ifndef NDEBUG
#		define NDEBUG
#	endif
#	include <assert.h>
#	define debug(msg)
#	define debugf(msg, ...)
#	define oplog(msg)
#	define oplogf(msg, ...)
#endif

#if defined(SINK_DEBUG) || defined(SINK_MEMTEST)

//
// memory leak detector for debug build
//

typedef struct m_debug_memlist_struct {
	void *p;
	const char *file;
	int line;
	struct m_debug_memlist_struct *next;
} m_debug_memlist_st, *m_debug_memlist;

static m_debug_memlist memlist = NULL;

static inline void *md_malloc(size_t s){
	void *p = malloc(s);
	if (p == NULL){
		fprintf(stderr, "Out of memory!\n");
		exit(1);
	}
	return p;
}

static inline void *md_realloc(void *p, size_t s){
	p = realloc(p, s);
	if (p == NULL){
		fprintf(stderr, "Out of memory!\n");
		exit(1);
	}
	return p;
}

static inline void md_free(void *p){
	free(p);
}

static void *mem_debug_alloc(size_t s, const char *file, int line){
	void *p = md_malloc(s);
	m_debug_memlist m = md_malloc(sizeof(m_debug_memlist_st));
	m->p = p;
	m->file = file;
	m->line = line;
	m->next = memlist;
	memlist = m;
	return p;
}

static void *mem_debug_realloc(void *p, size_t s, const char *file, int line){
	void *new_p;
	if (p == NULL){
		m_debug_memlist m = md_malloc(sizeof(m_debug_memlist_st));
		m->p = new_p = md_realloc(p, s);
		m->file = file;
		m->line = line;
		m->next = memlist;
		memlist = m;
	}
	else{
		m_debug_memlist m = memlist;
		bool found = false;
		while (m){
			if (m->p == p){
				found = true;
				m->p = new_p = md_realloc(p, s);
				m->file = file;
				m->line = line;
				break;
			}
			m = m->next;
		}
		if (!found){
			printf("Reallocated a pointer that wasn't originally allocated\n"
				"File: %s\nLine: %d\n", file, line);
		}
	}
	return new_p;
}

static void mem_debug_free(void *p, const char *file, int line){
	if (p == NULL)
		return;
	m_debug_memlist *m = &memlist;
	bool found = false;
	while (*m){
		if ((*m)->p == p){
			found = true;
			md_free(p);
			void *f = *m;
			*m = (*m)->next;
			md_free(f);
			break;
		}
		m = &(*m)->next;
	}
	if (!found){
		printf("Freeing a pointer that wasn't originally allocated\n"
			"File: %s\nLine: %d\n", file, line);
	}
}

static void mem_debug_done(){
	m_debug_memlist m = memlist;
	if (m){
		printf("Failed to free memory allocated on:\n");
		while (m){
			printf("%s:%d (%p)\n", m->file, m->line, m->p);
			m_debug_memlist f = m;
			m = m->next;
			md_free(f->p);
			md_free(f);
		}
		memlist = NULL;
	}
}

static void *mem_alloc_func(size_t s){
	return mem_debug_alloc(s, "<indirect>", 0);
}

static void *mem_realloc_func(void *p, size_t s){
	return mem_debug_realloc(p, s, "<indirect>", 0);
}

static void mem_free_func(void *p){
	mem_debug_free(p, "<indirect>", 0);
}

sink_malloc_f  sink_malloc  = mem_alloc_func;
sink_realloc_f sink_realloc = mem_realloc_func;
sink_free_f    sink_free    = mem_free_func;

#	define mem_alloc(s)       mem_debug_alloc(s, __FILE__, __LINE__)
#	define mem_realloc(p, s)  mem_debug_realloc(p, s, __FILE__, __LINE__)
#	define mem_free(p)        mem_debug_free(p, __FILE__, __LINE__)
#	define mem_done()         mem_debug_done()
#else

//
// production memory routines wired to sink_malloc/etc
//

sink_malloc_f  sink_malloc  = malloc;
sink_realloc_f sink_realloc = realloc;
sink_free_f    sink_free    = free;

static inline void *mem_prod_alloc(size_t s){
	void *p = sink_malloc(s);
	if (p == NULL){
		fprintf(stderr, "Out of memory!\n");
		exit(1);
	}
	return p;
}

static inline void *mem_prod_realloc(void *p, size_t s){
	p = sink_realloc(p, s);
	if (p == NULL){
		fprintf(stderr, "Out of memory!\n");
		exit(1);
	}
	return p;
}

static inline void mem_prod_free(void *p){
	sink_free(p);
}

#	define mem_alloc(s)       mem_prod_alloc(s)
#	define mem_realloc(p, s)  mem_prod_realloc(p, s)
#	define mem_free(p)        mem_prod_free(p)
#	define mem_free_func      mem_prod_free
#	define mem_done()
#endif

//
// setup seedauto defaulting to clock() from time.h
//

static uint32_t wrap_clock(){ return (uint32_t)clock(); }
sink_seedauto_src_f sink_seedauto_src = wrap_clock;

//
// string creation
//

#if !defined(SINK_WIN)
#	define vsprintf_s(a, b, c, d)  vsprintf(a, c, d)
#endif

static char *format(const char *fmt, ...){
	va_list args, args2;
	va_start(args, fmt);
	va_copy(args2, args);
	size_t s = vsnprintf(NULL, 0, fmt, args);
	char *buf = mem_alloc(s + 1);
	vsprintf_s(buf, s + 1, fmt, args2);
	va_end(args);
	va_end(args2);
	return buf;
}

//
// variable length list implementations
//

typedef struct {
	uint8_t *bytes;
	uint_fast32_t size;
	uint_fast32_t count;
} list_byte_st, *list_byte;

const static int list_byte_grow = 200;

static inline void list_byte_free(list_byte b){
	mem_free(b->bytes);
	mem_free(b);
}

static inline str_st list_byte_freetostr(list_byte b){
	if (b->size <= 0){
		list_byte_free(b);
		return (str_st){ .size = 0, .bytes = NULL };
	}
	str_st res = (str_st){ .size = b->size, .bytes = b->bytes };
	mem_free(b);
	return res;
}

static inline char *list_byte_freetochar(list_byte b){
	char *ret = (char *)b->bytes;
	mem_free(b);
	return ret;
}

static inline list_byte list_byte_new(){
	list_byte b = mem_alloc(sizeof(list_byte_st));
	b->size = 0;
	b->count = list_byte_grow;
	b->bytes = mem_alloc(sizeof(uint8_t) * b->count);
#if defined(SINK_DEBUG) || defined(SINK_MEMTEST)
	memset(b->bytes, 0x55, sizeof(uint8_t) * b->count);
#endif
	return b;
}

static inline list_byte list_byte_newcopy(list_byte b){
	list_byte b2 = mem_alloc(sizeof(list_byte_st));
	b2->size = b->size;
	b2->count = b->size + 1; // make room for NULL if required later
	b2->bytes = mem_alloc(sizeof(uint8_t) * b2->count);
#if defined(SINK_DEBUG) || defined(SINK_MEMTEST)
	memset(b2->bytes, 0x55, sizeof(uint8_t) * b2->count);
#endif
	if (b->size > 0)
		memcpy(b2->bytes, b->bytes, sizeof(uint8_t) * b->size);
	return b2;
}

static inline list_byte list_byte_newstr(const char *data){
	list_byte b = mem_alloc(sizeof(list_byte_st));
	b->size = (int)strlen(data);
	b->count = b->size + 1;
	b->bytes = mem_alloc(sizeof(uint8_t) * b->count);
	memcpy(b->bytes, data, sizeof(uint8_t) * b->count);
	return b;
}

static inline void list_byte_push(list_byte b, uint8_t v){
	if (b->size + 1 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v;
}

static inline void list_byte_null(list_byte b){
	// make sure the buffer is NULL terminated
	if (b->size + 1 > b->count){
		b->count = b->size + 1;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size] = 0;
}

static inline void list_byte_push2(list_byte b, uint8_t v1, uint8_t v2){
	if (b->size + 2 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
}

static inline void list_byte_push3(list_byte b, uint8_t v1, uint8_t v2, uint8_t v3){
	if (b->size + 3 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
	b->bytes[b->size++] = v3;
}

static inline void list_byte_push4(list_byte b, uint8_t v1, uint8_t v2, uint8_t v3, uint8_t v4){
	if (b->size + 4 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
	b->bytes[b->size++] = v3;
	b->bytes[b->size++] = v4;
}

static inline void list_byte_push5(list_byte b, uint8_t v1, uint8_t v2, uint8_t v3, uint8_t v4,
	uint8_t v5){
	if (b->size + 5 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
	b->bytes[b->size++] = v3;
	b->bytes[b->size++] = v4;
	b->bytes[b->size++] = v5;
}

static inline void list_byte_push6(list_byte b, uint8_t v1, uint8_t v2, uint8_t v3, uint8_t v4,
	uint8_t v5, uint8_t v6){
	if (b->size + 6 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
	b->bytes[b->size++] = v3;
	b->bytes[b->size++] = v4;
	b->bytes[b->size++] = v5;
	b->bytes[b->size++] = v6;
}

static inline void list_byte_push7(list_byte b, uint8_t v1, uint8_t v2, uint8_t v3, uint8_t v4,
	uint8_t v5, uint8_t v6, uint8_t v7){
	if (b->size + 7 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
	b->bytes[b->size++] = v3;
	b->bytes[b->size++] = v4;
	b->bytes[b->size++] = v5;
	b->bytes[b->size++] = v6;
	b->bytes[b->size++] = v7;
}

static inline void list_byte_push8(list_byte b, uint8_t v1, uint8_t v2, uint8_t v3, uint8_t v4,
	uint8_t v5, uint8_t v6, uint8_t v7, uint8_t v8){
	if (b->size + 8 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
	b->bytes[b->size++] = v3;
	b->bytes[b->size++] = v4;
	b->bytes[b->size++] = v5;
	b->bytes[b->size++] = v6;
	b->bytes[b->size++] = v7;
	b->bytes[b->size++] = v8;
}

static inline void list_byte_push9(list_byte b, uint8_t v1, uint8_t v2, uint8_t v3, uint8_t v4,
	uint8_t v5, uint8_t v6, uint8_t v7, uint8_t v8, uint8_t v9){
	if (b->size + 9 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
	b->bytes[b->size++] = v3;
	b->bytes[b->size++] = v4;
	b->bytes[b->size++] = v5;
	b->bytes[b->size++] = v6;
	b->bytes[b->size++] = v7;
	b->bytes[b->size++] = v8;
	b->bytes[b->size++] = v9;
}

static inline void list_byte_push11(list_byte b, uint8_t v1, uint8_t v2, uint8_t v3, uint8_t v4,
	uint8_t v5, uint8_t v6, uint8_t v7, uint8_t v8, uint8_t v9, uint8_t v10, uint8_t v11){
	if (b->size + 11 > b->count){
		b->count += list_byte_grow;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	b->bytes[b->size++] = v1;
	b->bytes[b->size++] = v2;
	b->bytes[b->size++] = v3;
	b->bytes[b->size++] = v4;
	b->bytes[b->size++] = v5;
	b->bytes[b->size++] = v6;
	b->bytes[b->size++] = v7;
	b->bytes[b->size++] = v8;
	b->bytes[b->size++] = v9;
	b->bytes[b->size++] = v10;
	b->bytes[b->size++] = v11;
}

static inline void list_byte_append(list_byte b, int size, const uint8_t *bytes){
	if (size <= 0)
		return;
	if (b->size + size > b->count){
		b->count = b->size + size;
		b->bytes = mem_realloc(b->bytes, sizeof(uint8_t) * b->count);
	}
	memcpy(&b->bytes[b->size], bytes, sizeof(uint8_t) * size);
	b->size += size;
}

static inline bool byteequ(list_byte b, const char *str){
	int i;
	for (i = 0; str[i] != 0; i++){
		if (b->size <= i)
			return false;
		if (b->bytes[i] != (uint8_t)str[i])
			return false;
	}
	return b->size == i;
}

static inline bool list_byte_equ(list_byte b1, list_byte b2){
	if (b1->size != b2->size)
		return false;
	return memcmp(b1->bytes, b2->bytes, sizeof(uint8_t) * b1->size) == 0;
}

typedef struct {
	int *vals;
	uint_fast32_t size;
	uint_fast32_t count;
} list_int_st, *list_int;

const int list_int_grow = 200;

static inline void list_int_free(list_int ls){
	mem_free(ls->vals);
	mem_free(ls);
}

static inline list_int list_int_new(){
	list_int ls = mem_alloc(sizeof(list_int_st));
	ls->size = 0;
	ls->count = list_int_grow;
	ls->vals = mem_alloc(sizeof(int) * ls->count);
	return ls;
}

static inline void list_int_push(list_int ls, int v){
	if (ls->size >= ls->count){
		ls->count += list_int_grow;
		ls->vals = mem_realloc(ls->vals, sizeof(int) * ls->count);
	}
	ls->vals[ls->size++] = v;
}

static inline int list_int_pop(list_int ls){
	ls->size--;
	return ls->vals[ls->size];
}

static inline int list_int_at(list_int ls, int v){
	for (int i = 0; i < ls->size; i++){
		if (ls->vals[i] == v)
			return i;
	}
	return -1;
}

static inline bool list_int_has(list_int ls, int v){
	return list_int_at(ls, v) != -1;
}

typedef struct {
	uint64_t *vals;
	uint_fast32_t size;
	uint_fast32_t count;
} list_u64_st, *list_u64;

const int list_u64_grow = 200;

static inline void list_u64_free(list_u64 ls){
	mem_free(ls->vals);
	mem_free(ls);
}

static inline list_u64 list_u64_new(){
	list_u64 ls = mem_alloc(sizeof(list_u64_st));
	ls->size = 0;
	ls->count = list_u64_grow;
	ls->vals = mem_alloc(sizeof(uint64_t) * ls->count);
	return ls;
}

static inline void list_u64_push(list_u64 ls, uint64_t v){
	if (ls->size >= ls->count){
		ls->count += list_u64_grow;
		ls->vals = mem_realloc(ls->vals, sizeof(uint64_t) * ls->count);
	}
	ls->vals[ls->size++] = v;
}

typedef struct {
	void **ptrs;
	sink_free_f f_free;
	uint_fast32_t size;
	uint_fast32_t count;
} list_ptr_st, *list_ptr;

const static int list_ptr_grow = 200;

static list_ptr list_ptr_newf(sink_free_f f_free){
	list_ptr ls = mem_alloc(sizeof(list_ptr_st));
	ls->size = 0;
	ls->count = list_ptr_grow;
	ls->ptrs = mem_alloc(sizeof(void *) * ls->count);
	ls->f_free = f_free;
	return ls;
}

#define list_ptr_new(f) list_ptr_newf((sink_free_f)f)

static inline list_ptr list_ptr_newsingle(sink_free_f f_free, void *p){
	list_ptr ls = mem_alloc(sizeof(list_ptr_st));
	ls->size = 1;
	ls->count = 1;
	ls->ptrs = mem_alloc(sizeof(void *) * ls->count);
	ls->f_free = f_free;
	ls->ptrs[0] = p;
	return ls;
}

static void list_ptr_append(list_ptr ls, list_ptr data){
	if (data->size <= 0)
		return;
	if (ls->size + data->size >= ls->count){
		ls->count = ls->size + data->size + list_ptr_grow;
		ls->ptrs = mem_realloc(ls->ptrs, sizeof(void *) * ls->count);
	}
	memcpy(&ls->ptrs[ls->size], data->ptrs, sizeof(void *) * data->size);
	ls->size += data->size;
}

static void list_ptr_push(list_ptr ls, void *p){
	if (ls->size >= ls->count){
		ls->count += list_ptr_grow;
		ls->ptrs = mem_realloc(ls->ptrs, sizeof(void *) * ls->count);
	}
	ls->ptrs[ls->size++] = p;
}

static inline void *list_ptr_pop(list_ptr ls){
	return ls->ptrs[--ls->size];
}

static inline void *list_ptr_shift(list_ptr ls){
	void *ret = ls->ptrs[0];
	ls->size--;
	if (ls->size > 0)
		memmove(ls->ptrs, &ls->ptrs[1], sizeof(void *) * ls->size);
	return ret;
}

static inline int list_ptr_find(list_ptr ls, void *p){
	for (int i = 0; i < ls->size; i++){
		if (ls->ptrs[i] == p)
			return i;
	}
	return -1;
}

static inline bool list_ptr_has(list_ptr ls, void *p){
	return list_ptr_find(ls, p) >= 0;
}

static inline void list_ptr_remove(list_ptr ls, int index){
	// does not free the pointer!
	if (index < ls->size - 1)
		memmove(&ls->ptrs[index], &ls->ptrs[index + 1], sizeof(void *) * (ls->size - index));
	ls->size--;
}

static void list_ptr_free(list_ptr ls){
	if (ls->f_free){
		while (ls->size > 0)
			ls->f_free(ls->ptrs[--ls->size]);
	}
	mem_free(ls->ptrs);
	mem_free(ls);
}

// cleanup helper
typedef struct {
	list_ptr cuser;
	list_ptr f_free;
} cleanup_st, *cleanup;

static inline cleanup cleanup_new(){
	cleanup cup = mem_alloc(sizeof(cleanup_st));
	cup->cuser = list_ptr_new(NULL);
	cup->f_free = list_ptr_new(NULL);
	return cup;
}

static inline void cleanup_add(cleanup cup, void *cuser, sink_free_f f_free){
	list_ptr_push(cup->cuser, cuser);
	list_ptr_push(cup->f_free, f_free);
}

static inline void cleanup_free(cleanup cup){
	for (int i = 0; i < cup->cuser->size; i++){
		sink_free_f f_free = cup->f_free->ptrs[i];
		f_free(cup->cuser->ptrs[i]);
	}
	list_ptr_free(cup->cuser);
	list_ptr_free(cup->f_free);
	mem_free(cup);
}

typedef struct {
	int frame;
	int index;
} varloc_st;

static inline varloc_st varloc_new(int frame, int index){
	return (varloc_st){ .frame = frame, .index = index };
}

static const varloc_st VARLOC_NULL = (varloc_st){ .frame = -1 };

static inline bool varloc_isnull(varloc_st vlc){
	return vlc.frame < 0;
}

static inline uint64_t native_hash(int size, const uint8_t *bytes){
	uint32_t hash[4];
	sink_str_hashplain(size, bytes, 0, hash);
	return ((uint64_t)hash[1] << 32) | hash[0];
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//
// compiler
//
////////////////////////////////////////////////////////////////////////////////////////////////////


//
// opcodes
//

// key: SINGLEBYTE  [TWOBYTES]  [[FOURBYTES]]  [[[EIGHTBYTES]]]
typedef enum {
	OP_NOP             = 0x00, //
	OP_MOVE            = 0x01, // [TGT], [SRC]
	OP_INC             = 0x02, // [TGT/SRC]
	OP_NIL             = 0x03, // [TGT]
	OP_NUMP8           = 0x04, // [TGT], VALUE
	OP_NUMN8           = 0x05, // [TGT], VALUE
	OP_NUMP16          = 0x06, // [TGT], [VALUE]
	OP_NUMN16          = 0x07, // [TGT], [VALUE]
	OP_NUMP32          = 0x08, // [TGT], [[VALUE]]
	OP_NUMN32          = 0x09, // [TGT], [[VALUE]]
	OP_NUMDBL          = 0x0A, // [TGT], [[[VALUE]]]
	OP_STR             = 0x0B, // [TGT], [[INDEX]]
	OP_LIST            = 0x0C, // [TGT], HINT
	OP_ISNUM           = 0x0D, // [TGT], [SRC]
	OP_ISSTR           = 0x0E, // [TGT], [SRC]
	OP_ISLIST          = 0x0F, // [TGT], [SRC]
	OP_NOT             = 0x10, // [TGT], [SRC]
	OP_SIZE            = 0x11, // [TGT], [SRC]
	OP_TONUM           = 0x12, // [TGT], [SRC]
	OP_CAT             = 0x13, // [TGT], ARGCOUNT, [ARGS]...
	OP_LT              = 0x14, // [TGT], [SRC1], [SRC2]
	OP_LTE             = 0x15, // [TGT], [SRC1], [SRC2]
	OP_NEQ             = 0x16, // [TGT], [SRC1], [SRC2]
	OP_EQU             = 0x17, // [TGT], [SRC1], [SRC2]
	OP_GETAT           = 0x18, // [TGT], [SRC1], [SRC2]
	OP_SLICE           = 0x19, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_SETAT           = 0x1A, // [SRC1], [SRC2], [SRC3]
	OP_SPLICE          = 0x1B, // [SRC1], [SRC2], [SRC3], [SRC4]
	OP_JUMP            = 0x1C, // [[LOCATION]]
	OP_JUMPTRUE        = 0x1D, // [SRC], [[LOCATION]]
	OP_JUMPFALSE       = 0x1E, // [SRC], [[LOCATION]]
	OP_CMDHEAD         = 0x1F, // LEVEL, RESTPOS
	OP_CMDTAIL         = 0x20, //
	OP_CALL            = 0x21, // [TGT], [[LOCATION]], ARGCOUNT, [ARGS]...
	OP_ISNATIVE        = 0x22, // [TGT], [[INDEX]]
	OP_NATIVE          = 0x23, // [TGT], [[INDEX]], ARGCOUNT, [ARGS]...
	OP_RETURN          = 0x24, // [SRC]
	OP_RETURNTAIL      = 0x25, // [[LOCATION]], ARGCOUNT, [ARGS]...
	OP_RANGE           = 0x26, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_ORDER           = 0x27, // [TGT], [SRC1], [SRC2]
	OP_SAY             = 0x28, // [TGT], ARGCOUNT, [ARGS]...
	OP_WARN            = 0x29, // [TGT], ARGCOUNT, [ARGS]...
	OP_ASK             = 0x2A, // [TGT], ARGCOUNT, [ARGS]...
	OP_EXIT            = 0x2B, // [TGT], ARGCOUNT, [ARGS]...
	OP_ABORT           = 0x2C, // [TGT], ARGCOUNT, [ARGS]...
	OP_STACKTRACE      = 0x2D, // [TGT]
	OP_NUM_NEG         = 0x2E, // [TGT], [SRC]
	OP_NUM_ADD         = 0x2F, // [TGT], [SRC1], [SRC2]
	OP_NUM_SUB         = 0x30, // [TGT], [SRC1], [SRC2]
	OP_NUM_MUL         = 0x31, // [TGT], [SRC1], [SRC2]
	OP_NUM_DIV         = 0x32, // [TGT], [SRC1], [SRC2]
	OP_NUM_MOD         = 0x33, // [TGT], [SRC1], [SRC2]
	OP_NUM_POW         = 0x34, // [TGT], [SRC1], [SRC2]
	OP_NUM_ABS         = 0x35, // [TGT], [SRC]
	OP_NUM_SIGN        = 0x36, // [TGT], [SRC]
	OP_NUM_MAX         = 0x37, // [TGT], ARGCOUNT, [ARGS]...
	OP_NUM_MIN         = 0x38, // [TGT], ARGCOUNT, [ARGS]...
	OP_NUM_CLAMP       = 0x39, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_NUM_FLOOR       = 0x3A, // [TGT], [SRC]
	OP_NUM_CEIL        = 0x3B, // [TGT], [SRC]
	OP_NUM_ROUND       = 0x3C, // [TGT], [SRC]
	OP_NUM_TRUNC       = 0x3D, // [TGT], [SRC]
	OP_NUM_NAN         = 0x3E, // [TGT]
	OP_NUM_INF         = 0x3F, // [TGT]
	OP_NUM_ISNAN       = 0x40, // [TGT], [SRC]
	OP_NUM_ISFINITE    = 0x41, // [TGT], [SRC]
	OP_NUM_SIN         = 0x42, // [TGT], [SRC]
	OP_NUM_COS         = 0x43, // [TGT], [SRC]
	OP_NUM_TAN         = 0x44, // [TGT], [SRC]
	OP_NUM_ASIN        = 0x45, // [TGT], [SRC]
	OP_NUM_ACOS        = 0x46, // [TGT], [SRC]
	OP_NUM_ATAN        = 0x47, // [TGT], [SRC]
	OP_NUM_ATAN2       = 0x48, // [TGT], [SRC1], [SRC2]
	OP_NUM_LOG         = 0x49, // [TGT], [SRC]
	OP_NUM_LOG2        = 0x4A, // [TGT], [SRC]
	OP_NUM_LOG10       = 0x4B, // [TGT], [SRC]
	OP_NUM_EXP         = 0x4C, // [TGT], [SRC]
	OP_NUM_LERP        = 0x4D, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_NUM_HEX         = 0x4E, // [TGT], [SRC1], [SRC2]
	OP_NUM_OCT         = 0x4F, // [TGT], [SRC1], [SRC2]
	OP_NUM_BIN         = 0x50, // [TGT], [SRC1], [SRC2]
	OP_INT_NEW         = 0x51, // [TGT], [SRC]
	OP_INT_NOT         = 0x52, // [TGT], [SRC]
	OP_INT_AND         = 0x53, // [TGT], ARGCOUNT, [ARGS]...
	OP_INT_OR          = 0x54, // [TGT], ARGCOUNT, [ARGS]...
	OP_INT_XOR         = 0x55, // [TGT], ARGCOUNT, [ARGS]...
	OP_INT_SHL         = 0x56, // [TGT], [SRC1], [SRC2]
	OP_INT_SHR         = 0x57, // [TGT], [SRC1], [SRC2]
	OP_INT_SAR         = 0x58, // [TGT], [SRC1], [SRC2]
	OP_INT_ADD         = 0x59, // [TGT], [SRC1], [SRC2]
	OP_INT_SUB         = 0x5A, // [TGT], [SRC1], [SRC2]
	OP_INT_MUL         = 0x5B, // [TGT], [SRC1], [SRC2]
	OP_INT_DIV         = 0x5C, // [TGT], [SRC1], [SRC2]
	OP_INT_MOD         = 0x5D, // [TGT], [SRC1], [SRC2]
	OP_INT_CLZ         = 0x5E, // [TGT], [SRC]
	OP_INT_POP         = 0x5F, // [TGT], [SRC]
	OP_INT_BSWAP       = 0x60, // [TGT], [SRC]
	OP_RAND_SEED       = 0x61, // [TGT], [SRC]
	OP_RAND_SEEDAUTO   = 0x62, // [TGT]
	OP_RAND_INT        = 0x63, // [TGT]
	OP_RAND_NUM        = 0x64, // [TGT]
	OP_RAND_RANGE      = 0x65, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_RAND_GETSTATE   = 0x66, // [TGT]
	OP_RAND_SETSTATE   = 0x67, // [TGT], [SRC]
	OP_RAND_PICK       = 0x68, // [TGT], [SRC]
	OP_RAND_SHUFFLE    = 0x69, // [TGT], [SRC]
	OP_STR_NEW         = 0x6A, // [TGT], ARGCOUNT, [ARGS]...
	OP_STR_SPLIT       = 0x6B, // [TGT], [SRC1], [SRC2]
	OP_STR_REPLACE     = 0x6C, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_STR_BEGINS      = 0x6D, // [TGT], [SRC1], [SRC2]
	OP_STR_ENDS        = 0x6E, // [TGT], [SRC1], [SRC2]
	OP_STR_PAD         = 0x6F, // [TGT], [SRC1], [SRC2]
	OP_STR_FIND        = 0x70, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_STR_RFIND       = 0x71, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_STR_LOWER       = 0x72, // [TGT], [SRC]
	OP_STR_UPPER       = 0x73, // [TGT], [SRC]
	OP_STR_TRIM        = 0x74, // [TGT], [SRC]
	OP_STR_REV         = 0x75, // [TGT], [SRC]
	OP_STR_REP         = 0x76, // [TGT], [SRC1], [SRC2]
	OP_STR_LIST        = 0x77, // [TGT], [SRC]
	OP_STR_BYTE        = 0x78, // [TGT], [SRC1], [SRC2]
	OP_STR_HASH        = 0x79, // [TGT], [SRC1], [SRC2]
	OP_UTF8_VALID      = 0x7A, // [TGT], [SRC]
	OP_UTF8_LIST       = 0x7B, // [TGT], [SRC]
	OP_UTF8_STR        = 0x7C, // [TGT], [SRC]
	OP_STRUCT_SIZE     = 0x7D, // [TGT], [SRC]
	OP_STRUCT_STR      = 0x7E, // [TGT], [SRC1], [SRC2]
	OP_STRUCT_LIST     = 0x7F, // [TGT], [SRC1], [SRC2]
	OP_STRUCT_ISLE     = 0x80, // [TGT]
	OP_LIST_NEW        = 0x81, // [TGT], [SRC1], [SRC2]
	OP_LIST_SHIFT      = 0x82, // [TGT], [SRC]
	OP_LIST_POP        = 0x83, // [TGT], [SRC]
	OP_LIST_PUSH       = 0x84, // [TGT], [SRC1], [SRC2]
	OP_LIST_UNSHIFT    = 0x85, // [TGT], [SRC1], [SRC2]
	OP_LIST_APPEND     = 0x86, // [TGT], [SRC1], [SRC2]
	OP_LIST_PREPEND    = 0x87, // [TGT], [SRC1], [SRC2]
	OP_LIST_FIND       = 0x88, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_LIST_RFIND      = 0x89, // [TGT], [SRC1], [SRC2], [SRC3]
	OP_LIST_JOIN       = 0x8A, // [TGT], [SRC1], [SRC2]
	OP_LIST_REV        = 0x8B, // [TGT], [SRC]
	OP_LIST_STR        = 0x8C, // [TGT], [SRC]
	OP_LIST_SORT       = 0x8D, // [TGT], [SRC]
	OP_LIST_RSORT      = 0x8E, // [TGT], [SRC]
	OP_PICKLE_JSON     = 0x8F, // [TGT], [SRC]
	OP_PICKLE_BIN      = 0x90, // [TGT], [SRC]
	OP_PICKLE_VAL      = 0x91, // [TGT], [SRC]
	OP_PICKLE_VALID    = 0x92, // [TGT], [SRC]
	OP_PICKLE_SIBLING  = 0x93, // [TGT], [SRC]
	OP_PICKLE_CIRCULAR = 0x94, // [TGT], [SRC]
	OP_PICKLE_COPY     = 0x95, // [TGT], [SRC]
	OP_GC_GETLEVEL     = 0x96, // [TGT]
	OP_GC_SETLEVEL     = 0x97, // [TGT], [SRC]
	OP_GC_RUN          = 0x98, // [TGT]
	// RESERVED        = 0xFD,
	// fake ops
	OP_GT              = 0x1F0,
	OP_GTE             = 0x1F1,
	OP_PICK            = 0x1F2,
	OP_EMBED           = 0x1F3,
	OP_INVALID         = 0x1F4
} op_enum;

typedef enum {
	OPPC_INVALID,
	OPPC_STR,        // [VAR], [[INDEX]]
	OPPC_CMDHEAD,    // LEVEL, RESTPOS
	OPPC_CMDTAIL,    //
	OPPC_JUMP,       // [[LOCATION]]
	OPPC_VJUMP,      // [VAR], [[LOCATION]]
	OPPC_CALL,       // [VAR], [[LOCATION]], ARGCOUNT, [VARS]...
	OPPC_ISNATIVE,   // [VAR], [[INDEX]]
	OPPC_NATIVE,     // [VAR], [[INDEX]], ARGCOUNT, [VARS]...
	OPPC_RETURNTAIL, // [[LOCATION]], ARGCOUNT, [VARS]...
	OPPC_VVVV,       // [VAR], [VAR], [VAR], [VAR]
	OPPC_VVV,        // [VAR], [VAR], [VAR]
	OPPC_VV,         // [VAR], [VAR]
	OPPC_V,          // [VAR]
	OPPC_EMPTY,      // nothing
	OPPC_VA,         // [VAR], ARGCOUNT, [VARS]...
	OPPC_VN,         // [VAR], DATA
	OPPC_VNN,        // [VAR], [DATA]
	OPPC_VNNNN,      // [VAR], [[DATA]]
	OPPC_VNNNNNNNN   // [VAR], [[[DATA]]]
} op_pcat;

// lookup table for categorizing the operator types
static inline op_pcat op_paramcat(op_enum op){
	switch (op){
		case OP_NOP            : return OPPC_EMPTY;
		case OP_MOVE           : return OPPC_VV;
		case OP_INC            : return OPPC_V;
		case OP_NIL            : return OPPC_V;
		case OP_NUMP8          : return OPPC_VN;
		case OP_NUMN8          : return OPPC_VN;
		case OP_NUMP16         : return OPPC_VNN;
		case OP_NUMN16         : return OPPC_VNN;
		case OP_NUMP32         : return OPPC_VNNNN;
		case OP_NUMN32         : return OPPC_VNNNN;
		case OP_NUMDBL         : return OPPC_VNNNNNNNN;
		case OP_STR            : return OPPC_STR;
		case OP_LIST           : return OPPC_VN;
		case OP_ISNUM          : return OPPC_VV;
		case OP_ISSTR          : return OPPC_VV;
		case OP_ISLIST         : return OPPC_VV;
		case OP_NOT            : return OPPC_VV;
		case OP_SIZE           : return OPPC_VV;
		case OP_TONUM          : return OPPC_VV;
		case OP_CAT            : return OPPC_VA;
		case OP_LT             : return OPPC_VVV;
		case OP_LTE            : return OPPC_VVV;
		case OP_NEQ            : return OPPC_VVV;
		case OP_EQU            : return OPPC_VVV;
		case OP_GETAT          : return OPPC_VVV;
		case OP_SLICE          : return OPPC_VVVV;
		case OP_SETAT          : return OPPC_VVV;
		case OP_SPLICE         : return OPPC_VVVV;
		case OP_JUMP           : return OPPC_JUMP;
		case OP_JUMPTRUE       : return OPPC_VJUMP;
		case OP_JUMPFALSE      : return OPPC_VJUMP;
		case OP_CMDHEAD        : return OPPC_CMDHEAD;
		case OP_CMDTAIL        : return OPPC_CMDTAIL;
		case OP_CALL           : return OPPC_CALL;
		case OP_ISNATIVE       : return OPPC_ISNATIVE;
		case OP_NATIVE         : return OPPC_NATIVE;
		case OP_RETURN         : return OPPC_V;
		case OP_RETURNTAIL     : return OPPC_RETURNTAIL;
		case OP_RANGE          : return OPPC_VVVV;
		case OP_ORDER          : return OPPC_VVV;
		case OP_SAY            : return OPPC_VA;
		case OP_WARN           : return OPPC_VA;
		case OP_ASK            : return OPPC_VA;
		case OP_EXIT           : return OPPC_VA;
		case OP_ABORT          : return OPPC_VA;
		case OP_STACKTRACE     : return OPPC_V;
		case OP_NUM_NEG        : return OPPC_VV;
		case OP_NUM_ADD        : return OPPC_VVV;
		case OP_NUM_SUB        : return OPPC_VVV;
		case OP_NUM_MUL        : return OPPC_VVV;
		case OP_NUM_DIV        : return OPPC_VVV;
		case OP_NUM_MOD        : return OPPC_VVV;
		case OP_NUM_POW        : return OPPC_VVV;
		case OP_NUM_ABS        : return OPPC_VV;
		case OP_NUM_SIGN       : return OPPC_VV;
		case OP_NUM_MAX        : return OPPC_VA;
		case OP_NUM_MIN        : return OPPC_VA;
		case OP_NUM_CLAMP      : return OPPC_VVVV;
		case OP_NUM_FLOOR      : return OPPC_VV;
		case OP_NUM_CEIL       : return OPPC_VV;
		case OP_NUM_ROUND      : return OPPC_VV;
		case OP_NUM_TRUNC      : return OPPC_VV;
		case OP_NUM_NAN        : return OPPC_V;
		case OP_NUM_INF        : return OPPC_V;
		case OP_NUM_ISNAN      : return OPPC_VV;
		case OP_NUM_ISFINITE   : return OPPC_VV;
		case OP_NUM_SIN        : return OPPC_VV;
		case OP_NUM_COS        : return OPPC_VV;
		case OP_NUM_TAN        : return OPPC_VV;
		case OP_NUM_ASIN       : return OPPC_VV;
		case OP_NUM_ACOS       : return OPPC_VV;
		case OP_NUM_ATAN       : return OPPC_VV;
		case OP_NUM_ATAN2      : return OPPC_VVV;
		case OP_NUM_LOG        : return OPPC_VV;
		case OP_NUM_LOG2       : return OPPC_VV;
		case OP_NUM_LOG10      : return OPPC_VV;
		case OP_NUM_EXP        : return OPPC_VV;
		case OP_NUM_LERP       : return OPPC_VVVV;
		case OP_NUM_HEX        : return OPPC_VVV;
		case OP_NUM_OCT        : return OPPC_VVV;
		case OP_NUM_BIN        : return OPPC_VVV;
		case OP_INT_NEW        : return OPPC_VV;
		case OP_INT_NOT        : return OPPC_VV;
		case OP_INT_AND        : return OPPC_VA;
		case OP_INT_OR         : return OPPC_VA;
		case OP_INT_XOR        : return OPPC_VA;
		case OP_INT_SHL        : return OPPC_VVV;
		case OP_INT_SHR        : return OPPC_VVV;
		case OP_INT_SAR        : return OPPC_VVV;
		case OP_INT_ADD        : return OPPC_VVV;
		case OP_INT_SUB        : return OPPC_VVV;
		case OP_INT_MUL        : return OPPC_VVV;
		case OP_INT_DIV        : return OPPC_VVV;
		case OP_INT_MOD        : return OPPC_VVV;
		case OP_INT_CLZ        : return OPPC_VV;
		case OP_INT_POP        : return OPPC_VV;
		case OP_INT_BSWAP      : return OPPC_VV;
		case OP_RAND_SEED      : return OPPC_VV;
		case OP_RAND_SEEDAUTO  : return OPPC_V;
		case OP_RAND_INT       : return OPPC_V;
		case OP_RAND_NUM       : return OPPC_V;
		case OP_RAND_RANGE     : return OPPC_VVVV;
		case OP_RAND_GETSTATE  : return OPPC_V;
		case OP_RAND_SETSTATE  : return OPPC_VV;
		case OP_RAND_PICK      : return OPPC_VV;
		case OP_RAND_SHUFFLE   : return OPPC_VV;
		case OP_STR_NEW        : return OPPC_VA;
		case OP_STR_SPLIT      : return OPPC_VVV;
		case OP_STR_REPLACE    : return OPPC_VVVV;
		case OP_STR_BEGINS     : return OPPC_VVV;
		case OP_STR_ENDS       : return OPPC_VVV;
		case OP_STR_PAD        : return OPPC_VVV;
		case OP_STR_FIND       : return OPPC_VVVV;
		case OP_STR_RFIND      : return OPPC_VVVV;
		case OP_STR_LOWER      : return OPPC_VV;
		case OP_STR_UPPER      : return OPPC_VV;
		case OP_STR_TRIM       : return OPPC_VV;
		case OP_STR_REV        : return OPPC_VV;
		case OP_STR_REP        : return OPPC_VVV;
		case OP_STR_LIST       : return OPPC_VV;
		case OP_STR_BYTE       : return OPPC_VVV;
		case OP_STR_HASH       : return OPPC_VVV;
		case OP_UTF8_VALID     : return OPPC_VV;
		case OP_UTF8_LIST      : return OPPC_VV;
		case OP_UTF8_STR       : return OPPC_VV;
		case OP_STRUCT_SIZE    : return OPPC_VV;
		case OP_STRUCT_STR     : return OPPC_VVV;
		case OP_STRUCT_LIST    : return OPPC_VVV;
		case OP_STRUCT_ISLE    : return OPPC_V;
		case OP_LIST_NEW       : return OPPC_VVV;
		case OP_LIST_SHIFT     : return OPPC_VV;
		case OP_LIST_POP       : return OPPC_VV;
		case OP_LIST_PUSH      : return OPPC_VVV;
		case OP_LIST_UNSHIFT   : return OPPC_VVV;
		case OP_LIST_APPEND    : return OPPC_VVV;
		case OP_LIST_PREPEND   : return OPPC_VVV;
		case OP_LIST_FIND      : return OPPC_VVVV;
		case OP_LIST_RFIND     : return OPPC_VVVV;
		case OP_LIST_JOIN      : return OPPC_VVV;
		case OP_LIST_REV       : return OPPC_VV;
		case OP_LIST_STR       : return OPPC_VV;
		case OP_LIST_SORT      : return OPPC_VV;
		case OP_LIST_RSORT     : return OPPC_VV;
		case OP_PICKLE_JSON    : return OPPC_VV;
		case OP_PICKLE_BIN     : return OPPC_VV;
		case OP_PICKLE_VAL     : return OPPC_VV;
		case OP_PICKLE_VALID   : return OPPC_VV;
		case OP_PICKLE_SIBLING : return OPPC_VV;
		case OP_PICKLE_CIRCULAR: return OPPC_VV;
		case OP_PICKLE_COPY    : return OPPC_VV;
		case OP_GC_GETLEVEL    : return OPPC_V;
		case OP_GC_SETLEVEL    : return OPPC_VV;
		case OP_GC_RUN         : return OPPC_V;
		case OP_GT             : return OPPC_INVALID;
		case OP_GTE            : return OPPC_INVALID;
		case OP_PICK           : return OPPC_INVALID;
		case OP_EMBED          : return OPPC_INVALID;
		case OP_INVALID        : return OPPC_INVALID;
	}
	return OPPC_INVALID;
}

#ifdef SINK_DEBUG
static const char *op_pcat_name(op_pcat opc){
	switch (opc){
		case OPPC_INVALID   : return "OPPC_INVALID";
		case OPPC_STR       : return "OPPC_STR";
		case OPPC_CMDHEAD   : return "OPPC_CMDHEAD";
		case OPPC_CMDTAIL   : return "OPPC_CMDTAIL";
		case OPPC_JUMP      : return "OPPC_JUMP";
		case OPPC_VJUMP     : return "OPPC_VJUMP";
		case OPPC_CALL      : return "OPPC_CALL";
		case OPPC_ISNATIVE  : return "OPPC_ISNATIVE";
		case OPPC_NATIVE    : return "OPPC_NATIVE";
		case OPPC_RETURNTAIL: return "OPPC_RETURNTAIL";
		case OPPC_VVVV      : return "OPPC_VVVV";
		case OPPC_VVV       : return "OPPC_VVV";
		case OPPC_VV        : return "OPPC_VV";
		case OPPC_V         : return "OPPC_V";
		case OPPC_EMPTY     : return "OPPC_EMPTY";
		case OPPC_VA        : return "OPPC_VA";
		case OPPC_VN        : return "OPPC_VN";
		case OPPC_VNN       : return "OPPC_VNN";
		case OPPC_VNNNN     : return "OPPC_VNNNN";
		case OPPC_VNNNNNNNN : return "OPPC_VNNNNNNNN";
	}
	return "Unknown";
}
#endif

static inline void op_move(list_byte b, varloc_st tgt, varloc_st src){
	if (tgt.frame == src.frame && tgt.index == src.index)
		return;
	oplogf("MOVE %d:%d, %d:%d", tgt.frame, tgt.index, src.frame, src.index);
	list_byte_push5(b, OP_MOVE, tgt.frame, tgt.index, src.frame, src.index);
}

static inline void op_inc(list_byte b, varloc_st src){
	oplogf("INC %d:%d", src.frame, src.index);
	list_byte_push3(b, OP_INC, src.frame, src.index);
}

static inline void op_nil(list_byte b, varloc_st tgt){
	oplogf("NIL %d:%d", tgt.frame, tgt.index);
	list_byte_push3(b, OP_NIL, tgt.frame, tgt.index);
}

static inline void op_numint(list_byte b, varloc_st tgt, int64_t num){
	if (num < 0){
		if (num >= -256){
			oplogf("NUMN8 %d:%d, %lld", tgt.frame, tgt.index, num);
			num += 256;
			list_byte_push4(b, OP_NUMN8, tgt.frame, tgt.index, num & 0xFF);
		}
		else if (num >= -65536){
			oplogf("NUMN16 %d:%d, %lld", tgt.frame, tgt.index, num);
			num += 65536;
			list_byte_push5(b, OP_NUMN16, tgt.frame, tgt.index, num & 0xFF, num >> 8);
		}
		else{
			oplogf("NUMN32 %d:%d, %lld", tgt.frame, tgt.index, num);
			num += 4294967296;
			list_byte_push7(b, OP_NUMN32, tgt.frame, tgt.index,
				num & 0xFF, (num >> 8) & 0xFF, (num >> 16) & 0xFF, (num >> 24) & 0xFF);
		}
	}
	else{
		if (num < 256){
			oplogf("NUMP8 %d:%d, %lld", tgt.frame, tgt.index, num);
			list_byte_push4(b, OP_NUMP8, tgt.frame, tgt.index, num & 0xFF);
		}
		else if (num < 65536){
			oplogf("NUMP16 %d:%d, %lld", tgt.frame, tgt.index, num);
			list_byte_push5(b, OP_NUMP16, tgt.frame, tgt.index, num & 0xFF, num >> 8);
		}
		else{
			oplogf("NUMP32 %d:%d, %lld", tgt.frame, tgt.index, num);
			list_byte_push7(b, OP_NUMP32, tgt.frame, tgt.index,
				num & 0xFF, (num >> 8) & 0xFF, (num >> 16) & 0xFF, (num >> 24) & 0xFF);
		}
	}
}

static inline void op_numdbl(list_byte b, varloc_st tgt, sink_val num){
	oplogf("NUMDBL %d:%d, %g", tgt.frame, tgt.index, num.f);
	list_byte_push11(b, OP_NUMDBL, tgt.frame, tgt.index,
		num.u & 0xFF, (num.u >> 8) & 0xFF, (num.u >> 16) & 0xFF, (num.u >> 24) & 0xFF,
		(num.u >> 32) & 0xFF, (num.u >> 40) & 0xFF, (num.u >> 48) & 0xFF, (num.u >> 56) & 0xFF);
}

static inline void op_num(list_byte b, varloc_st tgt, double num){
	if (floor(num) == num && num >= -4294967296.0 && num < 4294967296.0)
		op_numint(b, tgt, (int64_t)num);
	else
		op_numdbl(b, tgt, (sink_val){ .f = num });
}

static inline void op_str(list_byte b, varloc_st tgt, int index){
	oplogf("STR %d:%d, %d", tgt.frame, tgt.index, index);
	list_byte_push7(b, OP_STR, tgt.frame, tgt.index,
		index % 256, (index >> 8) % 256, (index >> 16) % 256, (index >> 24) % 256);
}

static inline void op_list(list_byte b, varloc_st tgt, int hint){
	if (hint > 255)
		hint = 255;
	oplogf("LIST %d:%d, %d", tgt.frame, tgt.index, hint);
	list_byte_push4(b, OP_LIST, tgt.frame, tgt.index, hint);
}

static inline void op_unop(list_byte b, op_enum opcode, varloc_st tgt, varloc_st src){
	#ifdef SINK_DEBUG
	const char *opstr = "???";
	if      (opcode == OP_ISNUM     ) opstr = "ISNUM";
	else if (opcode == OP_ISSTR     ) opstr = "ISSTR";
	else if (opcode == OP_ISLIST    ) opstr = "ISLIST";
	else if (opcode == OP_NOT       ) opstr = "NOT";
	else if (opcode == OP_SIZE      ) opstr = "SIZE";
	else if (opcode == OP_TONUM     ) opstr = "TONUM";
	else if (opcode == OP_NUM_NEG   ) opstr = "NUM_NEG";
	else if (opcode == OP_LIST_SHIFT) opstr = "LIST_SHIFT";
	else if (opcode == OP_LIST_POP  ) opstr = "LIST_POP";
	oplogf("%s %d:%d, %d:%d", opstr, tgt.frame, tgt.index, src.frame, src.index);
	#endif
	list_byte_push5(b, opcode, tgt.frame, tgt.index, src.frame, src.index);
}

static inline void op_cat(list_byte b, varloc_st tgt, int argcount){
	oplogf("CAT %d:%d, %d", tgt.frame, tgt.index, argcount);
	list_byte_push4(b, OP_CAT, tgt.frame, tgt.index, argcount);
}

static inline void op_arg(list_byte b, varloc_st arg){
	oplogf("  ARG: %d:%d", arg.frame, arg.index);
	list_byte_push2(b, arg.frame, arg.index);
}

static inline void op_binop(list_byte b, op_enum opcode, varloc_st tgt, varloc_st src1,
	varloc_st src2){
	// intercept cat
	if (opcode == OP_CAT){
		op_cat(b, tgt, 2);
		op_arg(b, src1);
		op_arg(b, src2);
		return;
	}

	// rewire GT to LT and GTE to LTE
	if (opcode == OP_GT || opcode == OP_GTE){
		opcode = opcode == OP_GT ? OP_LT : OP_LTE;
		varloc_st t = src1;
		src1 = src2;
		src2 = t;
	}

	#ifdef SINK_DEBUG
	const char *opstr = "???";
	if      (opcode == OP_LT     ) opstr = "LT";
	else if (opcode == OP_LTE    ) opstr = "LTE";
	else if (opcode == OP_NEQ    ) opstr = "NEQ";
	else if (opcode == OP_EQU    ) opstr = "EQU";
	else if (opcode == OP_NUM_ADD) opstr = "NUM_ADD";
	else if (opcode == OP_NUM_SUB) opstr = "NUM_SUB";
	else if (opcode == OP_NUM_MUL) opstr = "NUM_MUL";
	else if (opcode == OP_NUM_DIV) opstr = "NUM_DIV";
	else if (opcode == OP_NUM_MOD) opstr = "NUM_MOD";
	else if (opcode == OP_NUM_POW) opstr = "NUM_POW";
	oplogf("%s %d:%d, %d:%d, %d:%d", opstr, tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index);
	#endif
	list_byte_push7(b, opcode, tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index);
}

static inline void op_getat(list_byte b, varloc_st tgt, varloc_st src1, varloc_st src2){
	oplogf("GETAT %d:%d, %d:%d, %d:%d", tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index);
	list_byte_push7(b, OP_GETAT, tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index);
}

static inline void op_slice(list_byte b, varloc_st tgt, varloc_st src1, varloc_st src2,
	varloc_st src3){
	oplogf("SLICE %d:%d, %d:%d, %d:%d, %d:%d", tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index, src3.frame, src3.index);
	list_byte_push9(b, OP_SLICE, tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index, src3.frame, src3.index);
}

static inline void op_setat(list_byte b, varloc_st src1, varloc_st src2, varloc_st src3){
	oplogf("SETAT %d:%d, %d:%d, %d:%d", src1.frame, src1.index, src2.frame, src2.index,
		src3.frame, src3.index);
	list_byte_push7(b, OP_SETAT, src1.frame, src1.index, src2.frame, src2.index,
		src3.frame, src3.index);
}

static inline void op_splice(list_byte b, varloc_st src1, varloc_st src2, varloc_st src3,
	varloc_st src4){
	oplogf("SPLICE %d:%d, %d:%d, %d:%d, %d:%d", src1.frame, src1.index, src2.frame, src2.index,
		src3.frame, src3.index, src4.frame, src4.index);
	list_byte_push9(b, OP_SPLICE, src1.frame, src1.index, src2.frame, src2.index,
		src3.frame, src3.index, src4.frame, src4.index);
}

static inline void op_jump(list_byte b, uint32_t index, list_byte hint){
	oplogf("JUMP %.*s", hint->size, hint->bytes);
	list_byte_push5(b, OP_JUMP,
		index % 256, (index >> 8) % 256, (index >> 16) % 256, (index >> 24) % 256);
}

static inline void op_jumptrue(list_byte b, varloc_st src, uint32_t index, list_byte hint){
	oplogf("JUMPTRUE %d:%d, %.*s", src.frame, src.index, hint->size, hint->bytes);
	list_byte_push7(b, OP_JUMPTRUE, src.frame, src.index,
		index % 256, (index >> 8) % 256, (index >> 16) % 256, (index >> 24) % 256);
}

static inline void op_jumpfalse(list_byte b, varloc_st src, uint32_t index, list_byte hint){
	oplogf("JUMPFALSE %d:%d, %.*s", src.frame, src.index, hint->size, hint->bytes);
	list_byte_push7(b, OP_JUMPFALSE, src.frame, src.index,
		index % 256, (index >> 8) % 256, (index >> 16) % 256, (index >> 24) % 256);
}

static inline void op_cmdhead(list_byte b, int level, int restpos){
	oplogf("CMDHEAD %d, %d", level, restpos);
	list_byte_push3(b, OP_CMDHEAD, level, restpos);
}

static inline void op_cmdtail(list_byte b){
	oplog("CMDTAIL");
	list_byte_push(b, OP_CMDTAIL);
}

static inline void op_call(list_byte b, varloc_st ret, uint32_t index, int argcount,
	list_byte hint){
	oplogf("CALL %d:%d, %.*s, %d", ret.frame, ret.index, hint->size, hint->bytes, argcount);
	list_byte_push8(b, OP_CALL, ret.frame, ret.index,
		index % 256, (index >> 8) % 256, (index >> 16) % 256, (index >> 24) % 256, argcount);
}

static inline void op_isnative(list_byte b, varloc_st tgt, int index){
	oplogf("ISNATIVE %d:%d, %d", tgt.frame, tgt.index, index);
	list_byte_push7(b, OP_ISNATIVE, tgt.frame, tgt.index,
		index % 256, (index >> 8) % 256, (index >> 16) % 256, (index >> 24) % 256);
}

static inline void op_native(list_byte b, varloc_st ret, int index, int argcount){
	oplogf("NATIVE %d:%d, %d, %d", ret.frame, ret.index, index, argcount);
	list_byte_push8(b, OP_NATIVE, ret.frame, ret.index,
		index % 256, (index >> 8) % 256, (index >> 16) % 256, (index >> 24) % 256, argcount);
}

static inline void op_return(list_byte b, varloc_st src){
	oplogf("RETURN %d:%d", src.frame, src.index);
	list_byte_push3(b, OP_RETURN, src.frame, src.index);
}

static inline void op_returntail(list_byte b, uint32_t index, int argcount, list_byte hint){
	oplogf("RETURNTAIL %.*s, %d", hint->size, hint->bytes, argcount);
	list_byte_push6(b, OP_RETURNTAIL,
		index % 256, (index >> 8) % 256, (index >> 16) % 256, (index >> 24) % 256, argcount);
}

static inline void op_parama(list_byte b, op_enum opcode, varloc_st tgt, int argcount){
	oplogf("0x%02X %d:%d, %d", opcode, tgt.frame, tgt.index, argcount);
	list_byte_push4(b, opcode, tgt.frame, tgt.index, argcount);
}

static inline void op_param0(list_byte b, op_enum opcode, varloc_st tgt){
	oplogf("0x%02X %d:%d", opcode, tgt.frame, tgt.index);
	list_byte_push3(b, opcode, tgt.frame, tgt.index);
}

static inline void op_param1(list_byte b, op_enum opcode, varloc_st tgt, varloc_st src){
	oplogf("0x%02X %d:%d, %d:%d", opcode, tgt.frame, tgt.index, src.frame, src.index);
	list_byte_push5(b, opcode, tgt.frame, tgt.index, src.frame, src.index);
}

static inline void op_param2(list_byte b, op_enum opcode, varloc_st tgt, varloc_st src1,
	varloc_st src2){
	oplogf("0x%02X %d:%d, %d:%d, %d:%d", opcode, tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index);
	list_byte_push7(b, opcode, tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index);
}

static inline void op_param3(list_byte b, op_enum opcode, varloc_st tgt, varloc_st src1,
	varloc_st src2, varloc_st src3){
	oplogf("0x%02X %d:%d, %d:%d, %d:%d, %d:%d", opcode, tgt.frame, tgt.index,
		src1.frame, src1.index, src2.frame, src2.index, src3.frame, src3.index);
	list_byte_push9(b, opcode, tgt.frame, tgt.index, src1.frame, src1.index,
		src2.frame, src2.index, src3.frame, src3.index);
}

//
// keywords/specials
//

typedef enum {
	KS_INVALID,
	KS_PLUS,
	KS_UNPLUS,
	KS_MINUS,
	KS_UNMINUS,
	KS_PERCENT,
	KS_STAR,
	KS_SLASH,
	KS_CARET,
	KS_AMP,
	KS_LT,
	KS_GT,
	KS_BANG,
	KS_EQU,
	KS_TILDE,
	KS_COLON,
	KS_COMMA,
	KS_PERIOD,
	KS_PIPE,
	KS_LPAREN,
	KS_LBRACKET,
	KS_LBRACE,
	KS_RPAREN,
	KS_RBRACKET,
	KS_RBRACE,
	KS_PLUSEQU,
	KS_MINUSEQU,
	KS_PERCENTEQU,
	KS_STAREQU,
	KS_SLASHEQU,
	KS_CARETEQU,
	KS_LTEQU,
	KS_GTEQU,
	KS_BANGEQU,
	KS_EQU2,
	KS_TILDEEQU,
	KS_AMP2,
	KS_PIPE2,
	KS_PERIOD3,
	KS_PIPE2EQU,
	KS_AMP2EQU,
	KS_BREAK,
	KS_CONTINUE,
	KS_DECLARE,
	KS_DEF,
	KS_DO,
	KS_ELSE,
	KS_ELSEIF,
	KS_END,
	KS_ENUM,
	KS_FOR,
	KS_GOTO,
	KS_IF,
	KS_INCLUDE,
	KS_NAMESPACE,
	KS_NIL,
	KS_RETURN,
	KS_USING,
	KS_VAR,
	KS_WHILE
} ks_enum;

#ifdef SINK_DEBUG
static const char *ks_name(ks_enum k){
	switch (k){
		case KS_INVALID:    return "KS_INVALID";
		case KS_PLUS:       return "KS_PLUS";
		case KS_UNPLUS:     return "KS_UNPLUS";
		case KS_MINUS:      return "KS_MINUS";
		case KS_UNMINUS:    return "KS_UNMINUS";
		case KS_PERCENT:    return "KS_PERCENT";
		case KS_STAR:       return "KS_STAR";
		case KS_SLASH:      return "KS_SLASH";
		case KS_CARET:      return "KS_CARET";
		case KS_AMP:        return "KS_AMP";
		case KS_LT:         return "KS_LT";
		case KS_GT:         return "KS_GT";
		case KS_BANG:       return "KS_BANG";
		case KS_EQU:        return "KS_EQU";
		case KS_TILDE:      return "KS_TILDE";
		case KS_COLON:      return "KS_COLON";
		case KS_COMMA:      return "KS_COMMA";
		case KS_PERIOD:     return "KS_PERIOD";
		case KS_PIPE:       return "KS_PIPE";
		case KS_LPAREN:     return "KS_LPAREN";
		case KS_LBRACKET:   return "KS_LBRACKET";
		case KS_LBRACE:     return "KS_LBRACE";
		case KS_RPAREN:     return "KS_RPAREN";
		case KS_RBRACKET:   return "KS_RBRACKET";
		case KS_RBRACE:     return "KS_RBRACE";
		case KS_PLUSEQU:    return "KS_PLUSEQU";
		case KS_MINUSEQU:   return "KS_MINUSEQU";
		case KS_PERCENTEQU: return "KS_PERCENTEQU";
		case KS_STAREQU:    return "KS_STAREQU";
		case KS_SLASHEQU:   return "KS_SLASHEQU";
		case KS_CARETEQU:   return "KS_CARETEQU";
		case KS_LTEQU:      return "KS_LTEQU";
		case KS_GTEQU:      return "KS_GTEQU";
		case KS_BANGEQU:    return "KS_BANGEQU";
		case KS_EQU2:       return "KS_EQU2";
		case KS_TILDEEQU:   return "KS_TILDEEQU";
		case KS_AMP2:       return "KS_AMP2";
		case KS_PIPE2:      return "KS_PIPE2";
		case KS_PERIOD3:    return "KS_PERIOD3";
		case KS_PIPE2EQU:   return "KS_PIPE2EQU";
		case KS_AMP2EQU:    return "KS_AMP2EQU";
		case KS_BREAK:      return "KS_BREAK";
		case KS_CONTINUE:   return "KS_CONTINUE";
		case KS_DECLARE:    return "KS_DECLARE";
		case KS_DEF:        return "KS_DEF";
		case KS_DO:         return "KS_DO";
		case KS_ELSE:       return "KS_ELSE";
		case KS_ELSEIF:     return "KS_ELSEIF";
		case KS_END:        return "KS_END";
		case KS_ENUM:       return "KS_ENUM";
		case KS_FOR:        return "KS_FOR";
		case KS_GOTO:       return "KS_GOTO";
		case KS_IF:         return "KS_IF";
		case KS_INCLUDE:    return "KS_INCLUDE";
		case KS_NAMESPACE:  return "KS_NAMESPACE";
		case KS_NIL:        return "KS_NIL";
		case KS_RETURN:     return "KS_RETURN";
		case KS_USING:      return "KS_USING";
		case KS_VAR:        return "KS_VAR";
		case KS_WHILE:      return "KS_WHILE";
	}
}
#endif

static inline ks_enum ks_char(char c){
	if      (c == '+') return KS_PLUS;
	else if (c == '-') return KS_MINUS;
	else if (c == '%') return KS_PERCENT;
	else if (c == '*') return KS_STAR;
	else if (c == '/') return KS_SLASH;
	else if (c == '^') return KS_CARET;
	else if (c == '&') return KS_AMP;
	else if (c == '<') return KS_LT;
	else if (c == '>') return KS_GT;
	else if (c == '!') return KS_BANG;
	else if (c == '=') return KS_EQU;
	else if (c == '~') return KS_TILDE;
	else if (c == ':') return KS_COLON;
	else if (c == ',') return KS_COMMA;
	else if (c == '.') return KS_PERIOD;
	else if (c == '|') return KS_PIPE;
	else if (c == '(') return KS_LPAREN;
	else if (c == '[') return KS_LBRACKET;
	else if (c == '{') return KS_LBRACE;
	else if (c == ')') return KS_RPAREN;
	else if (c == ']') return KS_RBRACKET;
	else if (c == '}') return KS_RBRACE;
	return KS_INVALID;
}

static inline ks_enum ks_char2(char c1, char c2){
	if      (c1 == '+' && c2 == '=') return KS_PLUSEQU;
	else if (c1 == '-' && c2 == '=') return KS_MINUSEQU;
	else if (c1 == '%' && c2 == '=') return KS_PERCENTEQU;
	else if (c1 == '*' && c2 == '=') return KS_STAREQU;
	else if (c1 == '/' && c2 == '=') return KS_SLASHEQU;
	else if (c1 == '^' && c2 == '=') return KS_CARETEQU;
	else if (c1 == '<' && c2 == '=') return KS_LTEQU;
	else if (c1 == '>' && c2 == '=') return KS_GTEQU;
	else if (c1 == '!' && c2 == '=') return KS_BANGEQU;
	else if (c1 == '=' && c2 == '=') return KS_EQU2;
	else if (c1 == '~' && c2 == '=') return KS_TILDEEQU;
	else if (c1 == '&' && c2 == '&') return KS_AMP2;
	else if (c1 == '|' && c2 == '|') return KS_PIPE2;
	return KS_INVALID;
}

static inline ks_enum ks_char3(char c1, char c2, char c3){
	if      (c1 == '.' && c2 == '.' && c3 == '.') return KS_PERIOD3;
	else if (c1 == '|' && c2 == '|' && c3 == '=') return KS_PIPE2EQU;
	else if (c1 == '&' && c2 == '&' && c3 == '=') return KS_AMP2EQU;
	return KS_INVALID;
}

static inline ks_enum ks_str(list_byte s){
	if      (byteequ(s, "break"    )) return KS_BREAK;
	else if (byteequ(s, "continue" )) return KS_CONTINUE;
	else if (byteequ(s, "declare"  )) return KS_DECLARE;
	else if (byteequ(s, "def"      )) return KS_DEF;
	else if (byteequ(s, "do"       )) return KS_DO;
	else if (byteequ(s, "else"     )) return KS_ELSE;
	else if (byteequ(s, "elseif"   )) return KS_ELSEIF;
	else if (byteequ(s, "end"      )) return KS_END;
	else if (byteequ(s, "enum"     )) return KS_ENUM;
	else if (byteequ(s, "for"      )) return KS_FOR;
	else if (byteequ(s, "goto"     )) return KS_GOTO;
	else if (byteequ(s, "if"       )) return KS_IF;
	else if (byteequ(s, "include"  )) return KS_INCLUDE;
	else if (byteequ(s, "namespace")) return KS_NAMESPACE;
	else if (byteequ(s, "nil"      )) return KS_NIL;
	else if (byteequ(s, "return"   )) return KS_RETURN;
	else if (byteequ(s, "using"    )) return KS_USING;
	else if (byteequ(s, "var"      )) return KS_VAR;
	else if (byteequ(s, "while"    )) return KS_WHILE;
	return KS_INVALID;
}

static inline op_enum ks_toUnaryOp(ks_enum k){
	if      (k == KS_PLUS   ) return OP_TONUM;
	else if (k == KS_UNPLUS ) return OP_TONUM;
	else if (k == KS_MINUS  ) return OP_NUM_NEG;
	else if (k == KS_UNMINUS) return OP_NUM_NEG;
	else if (k == KS_AMP    ) return OP_SIZE;
	else if (k == KS_BANG   ) return OP_NOT;
	return OP_INVALID;
}

static inline op_enum ks_toBinaryOp(ks_enum k){
	if      (k == KS_PLUS   ) return OP_NUM_ADD;
	else if (k == KS_MINUS  ) return OP_NUM_SUB;
	else if (k == KS_PERCENT) return OP_NUM_MOD;
	else if (k == KS_STAR   ) return OP_NUM_MUL;
	else if (k == KS_SLASH  ) return OP_NUM_DIV;
	else if (k == KS_CARET  ) return OP_NUM_POW;
	else if (k == KS_LT     ) return OP_LT;
	else if (k == KS_GT     ) return OP_GT;
	else if (k == KS_TILDE  ) return OP_CAT;
	else if (k == KS_LTEQU  ) return OP_LTE;
	else if (k == KS_GTEQU  ) return OP_GTE;
	else if (k == KS_BANGEQU) return OP_NEQ;
	else if (k == KS_EQU2   ) return OP_EQU;
	return OP_INVALID;
}

static inline op_enum ks_toMutateOp(ks_enum k){
	if      (k == KS_PLUSEQU   ) return OP_NUM_ADD;
	else if (k == KS_PERCENTEQU) return OP_NUM_MOD;
	else if (k == KS_MINUSEQU  ) return OP_NUM_SUB;
	else if (k == KS_STAREQU   ) return OP_NUM_MUL;
	else if (k == KS_SLASHEQU  ) return OP_NUM_DIV;
	else if (k == KS_CARETEQU  ) return OP_NUM_POW;
	else if (k == KS_TILDEEQU  ) return OP_CAT;
	return OP_INVALID;
}

//
// tokens
//

typedef struct {
	int32_t fullfile; // index into script's files
	int32_t basefile; // index into program's debug strings
	int32_t line;
	int32_t chr;
} filepos_st;

static const filepos_st FILEPOS_NULL = { .basefile = -1, .fullfile = -1, .line = -1, .chr = -1 };

typedef enum {
	TOK_NEWLINE,
	TOK_KS,
	TOK_IDENT,
	TOK_NUM,
	TOK_STR,
	TOK_ERROR
} tok_enum;

typedef struct {
	tok_enum type;
	filepos_st flp;
	union {
		bool soft;
		ks_enum k;
		list_byte ident;
		double num;
		list_byte str;
		char *msg;
	} u;
} tok_st, *tok;

static void tok_free(tok tk){
	switch (tk->type){
		case TOK_NEWLINE:
		case TOK_KS:
			break;
		case TOK_IDENT:
			if (tk->u.ident)
				list_byte_free(tk->u.ident);
			break;
		case TOK_NUM:
			break;
		case TOK_STR:
			if (tk->u.str)
				list_byte_free(tk->u.str);
			break;
		case TOK_ERROR:
			if (tk->u.msg)
				mem_free(tk->u.msg);
			break;
	}
	mem_free(tk);
}

static void tok_print(tok tk){
	#ifdef SINK_DEBUG
	switch (tk->type){
		case TOK_NEWLINE:
			debugf("TOK_NEWLINE [%d/%d/%d:%d]",
				tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr);
			break;
		case TOK_KS:
			debugf("TOK_KS [%d/%d/%d:%d] %s",
				tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr, ks_name(tk->u.k));
			break;
		case TOK_IDENT:
			if (tk->u.ident){
				debugf("TOK_IDENT [%d/%d/%d:%d] \"%.*s\"",
					tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr,
					tk->u.ident->size, tk->u.ident->bytes);
			}
			else{
				debugf("TOK_IDENT [%d/%d/%d:%d] NULL",
					tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr);
			}
			break;
		case TOK_NUM:
			debugf("TOK_NUM [%d/%d/%d:%d] %g",
				tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr, tk->u.num);
			break;
		case TOK_STR:
			if (tk->u.str){
				debugf("TOK_STR [%d/%d/%d:%d] \"%.*s\"",
					tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr,
					tk->u.str->size, tk->u.str->bytes);
			}
			else{
				debugf("TOK_STR [%d/%d/%d:%d] NULL",
					tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr);
			}
			break;
		case TOK_ERROR:
			if (tk->u.msg){
				debugf("TOK_ERROR [%d/%d/%d:%d] \"%s\"",
					tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr, tk->u.msg);
			}
			else{
				debugf("TOK_ERROR [%d/%d/%d:%d] NULL",
					tk->flp.basefile, tk->flp.fullfile, tk->flp.line, tk->flp.chr);
			}
			break;
	}
	#endif
}

#ifdef SINK_DEBUG
static inline void assertflp(filepos_st flp){
	assert(flp.line >= 1 && flp.chr >= 1);
}
#else
#	define assertflp(f)
#endif

static inline tok tok_newline(filepos_st flp, bool soft){
	assertflp(flp);
	tok tk = mem_alloc(sizeof(tok_st));
	tk->type = TOK_NEWLINE;
	tk->flp = flp;
	tk->u.soft = soft;
	return tk;
}

static inline tok tok_ks(filepos_st flp, ks_enum k){
	assertflp(flp);
	tok tk = mem_alloc(sizeof(tok_st));
	tk->type = TOK_KS;
	tk->flp = flp;
	tk->u.k = k;
	return tk;
}

static inline tok tok_ident(filepos_st flp, list_byte ident){
	assertflp(flp);
	tok tk = mem_alloc(sizeof(tok_st));
	tk->type = TOK_IDENT;
	tk->flp = flp;
	tk->u.ident = ident;
	return tk;
}

static inline tok tok_num(filepos_st flp, double num){
	assertflp(flp);
	tok tk = mem_alloc(sizeof(tok_st));
	tk->type = TOK_NUM;
	tk->flp = flp;
	tk->u.num = num;
	return tk;
}

static inline tok tok_str(filepos_st flp, list_byte str){
	assertflp(flp);
	tok tk = mem_alloc(sizeof(tok_st));
	tk->type = TOK_STR;
	tk->flp = flp;
	list_byte_null(str);
	tk->u.str = str;
	return tk;
}

static inline tok tok_error(filepos_st flp, char *msg){
	assertflp(flp);
	tok tk = mem_alloc(sizeof(tok_st));
	tk->type = TOK_ERROR;
	tk->flp = flp;
	tk->u.msg = msg;
	return tk;
}

static inline bool tok_isKS(tok tk, ks_enum k){
	return tk->type == TOK_KS && tk->u.k == k;
}

static inline bool tok_isMidStmt(tok tk){
	return tk->type == TOK_KS &&
		(tk->u.k == KS_END || tk->u.k == KS_ELSE || tk->u.k == KS_ELSEIF || tk->u.k == KS_WHILE);
}

static inline bool tok_isPre(tok tk){
	if (tk->type != TOK_KS)
		return false;
	ks_enum k = tk->u.k;
	return false ||
		k == KS_PLUS    ||
		k == KS_UNPLUS  ||
		k == KS_MINUS   ||
		k == KS_UNMINUS ||
		k == KS_AMP     ||
		k == KS_BANG    ||
		k == KS_PERIOD3;
}

static inline bool tok_isMid(tok tk, bool allowComma, bool allowPipe){
	if (tk->type != TOK_KS)
		return false;
	ks_enum k = tk->u.k;
	return false ||
		k == KS_PLUS       ||
		k == KS_PLUSEQU    ||
		k == KS_MINUS      ||
		k == KS_MINUSEQU   ||
		k == KS_PERCENT    ||
		k == KS_PERCENTEQU ||
		k == KS_STAR       ||
		k == KS_STAREQU    ||
		k == KS_SLASH      ||
		k == KS_SLASHEQU   ||
		k == KS_CARET      ||
		k == KS_CARETEQU   ||
		k == KS_LT         ||
		k == KS_LTEQU      ||
		k == KS_GT         ||
		k == KS_GTEQU      ||
		k == KS_BANGEQU    ||
		k == KS_EQU        ||
		k == KS_EQU2       ||
		k == KS_TILDE      ||
		k == KS_TILDEEQU   ||
		k == KS_AMP2       ||
		k == KS_PIPE2      ||
		k == KS_AMP2EQU    ||
		k == KS_PIPE2EQU   ||
		(allowComma && k == KS_COMMA) ||
		(allowPipe  && k == KS_PIPE );
}

static inline bool tok_isTerm(tok tk){
	return false ||
		(tk->type == TOK_KS &&
			(tk->u.k == KS_NIL || tk->u.k == KS_LPAREN || tk->u.k == KS_LBRACE)) ||
		tk->type == TOK_IDENT ||
		tk->type == TOK_NUM   ||
		tk->type == TOK_STR;
}

static inline bool tok_isPreBeforeMid(tok pre, tok mid){
	assert(pre->type == TOK_KS);
	assert(mid->type == TOK_KS);
	// -5^2 is -25, not 25
	if ((pre->u.k == KS_MINUS || pre->u.k == KS_UNMINUS) && mid->u.k == KS_CARET)
		return false;
	// otherwise, apply the Pre first
	return true;
}

static inline int tok_midPrecedence(tok tk){
	assert(tk->type == TOK_KS);
	ks_enum k = tk->u.k;
	if      (k == KS_CARET     ) return  1;
	else if (k == KS_STAR      ) return  2;
	else if (k == KS_SLASH     ) return  2;
	else if (k == KS_PERCENT   ) return  2;
	else if (k == KS_PLUS      ) return  3;
	else if (k == KS_MINUS     ) return  3;
	else if (k == KS_TILDE     ) return  4;
	else if (k == KS_LTEQU     ) return  5;
	else if (k == KS_LT        ) return  5;
	else if (k == KS_GTEQU     ) return  5;
	else if (k == KS_GT        ) return  5;
	else if (k == KS_BANGEQU   ) return  6;
	else if (k == KS_EQU2      ) return  6;
	else if (k == KS_AMP2      ) return  7;
	else if (k == KS_PIPE2     ) return  8;
	else if (k == KS_COMMA     ) return  9;
	else if (k == KS_PIPE      ) return 10;
	else if (k == KS_EQU       ) return 20;
	else if (k == KS_PLUSEQU   ) return 20;
	else if (k == KS_PERCENTEQU) return 20;
	else if (k == KS_MINUSEQU  ) return 20;
	else if (k == KS_STAREQU   ) return 20;
	else if (k == KS_SLASHEQU  ) return 20;
	else if (k == KS_CARETEQU  ) return 20;
	else if (k == KS_TILDEEQU  ) return 20;
	else if (k == KS_AMP2EQU   ) return 20;
	else if (k == KS_PIPE2EQU  ) return 20;
	assert(false);
	return -1;
}

static inline bool tok_isMidBeforeMid(tok lmid, tok rmid){
	assert(lmid->type == TOK_KS);
	assert(rmid->type == TOK_KS);
	int lp = tok_midPrecedence(lmid);
	int rp = tok_midPrecedence(rmid);
	if (lp < rp)
		return true;
	else if (lp > rp)
		return false;
	// otherwise, same precedence...
	if (lp == 20 || lp == 1) // mutation and pow are right to left
		return false;
	return true;
}

//
// lexer helper functions
//

static inline bool isSpace(char c){
	return c == ' ' || c == '\n' || c == '\r' || c == '\t';
}

static inline bool isAlpha(char c){
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

static inline bool isNum(char c){
	return c >= '0' && c <= '9';
}

static inline bool isIdentStart(char c){
	return isAlpha(c) || c == '_';
}

static inline bool isIdentBody(char c){
	return isIdentStart(c) || isNum(c);
}

static inline bool isHex(char c){
	return isNum(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

static inline int toHex(char c){
	if (isNum(c))
		return c - 48;
	else if (c >= 'a')
		return c - 87;
	return c - 55;
}

static inline char toNibble(int n){
	if (n >= 0 && n <= 9)
		return '0' + n;
	else if (n < 16)
		return 'A' + (n - 10);
	return '0';
}

//
// lexer
//

typedef enum {
	LEX_START,
	LEX_COMMENT_LINE,
	LEX_BACKSLASH,
	LEX_RETURN,
	LEX_COMMENT_BLOCK,
	LEX_SPECIAL1,
	LEX_SPECIAL2,
	LEX_IDENT,
	LEX_NUM_0,
	LEX_NUM_2,
	LEX_NUM_BODY,
	LEX_NUM_FRAC,
	LEX_NUM_EXP,
	LEX_NUM_EXP_BODY,
	LEX_STR_BASIC,
	LEX_STR_BASIC_ESC,
	LEX_STR_INTERP,
	LEX_STR_INTERP_DLR,
	LEX_STR_INTERP_DLR_ID,
	LEX_STR_INTERP_ESC,
	LEX_STR_INTERP_ESC_HEX
} lex_enum;

typedef struct {
	int    sign;  // value sign -1 or 1
	double val;   // integer part
	int    base;  // number base 2, 8, 10, or 16
	double frac;  // fractional part >= 0
	int    flen;  // number of fractional digits
	int    esign; // exponent sign -1 or 1
	int    eval;  // exponent value >= 0
} numpart_info;

static inline void numpart_new(numpart_info *info){
	info->sign  = 1;
	info->val   = 0;
	info->base  = 10;
	info->frac  = 0;
	info->flen  = 0;
	info->esign = 1;
	info->eval  = 0;
}

static inline double numpart_calc(numpart_info info){
	double val = info.val;
	double e = 1;
	if (info.eval > 0){
		e = pow(info.base == 10 ? 10.0 : 2.0, info.esign * info.eval);
		val *= e;
	}
	if (info.flen > 0){
		double d = pow(info.base, info.flen);
		val = (val * d + info.frac * e) / d;
	}
	return info.sign * val;
}

typedef struct {
	list_byte str;
	list_int braces;
	lex_enum state;
	numpart_info npi;
	filepos_st flpS; // filepos when state was LEX_START
	filepos_st flpR;
	filepos_st flp1;
	filepos_st flp2;
	filepos_st flp3;
	filepos_st flp4;
	char chR;
	char ch1;
	char ch2;
	char ch3;
	char ch4;
	int str_hexval;
	int str_hexleft;
	bool numexp;
} lex_st, *lex;

static inline void lex_free(lex lx){
	if (lx->str)
		list_byte_free(lx->str);
	list_int_free(lx->braces);
	mem_free(lx);
}

static void lex_reset(lex lx){
	lx->state = LEX_START;
	lx->flpS = lx->flpR = lx->flp1 = lx->flp2 = lx->flp3 = lx->flp4 = FILEPOS_NULL;
	lx->chR = lx->ch1 = lx->ch2 = lx->ch3 = lx->ch4 = 0;
	if (lx->str)
		list_byte_free(lx->str);
	lx->str = NULL;
	if (lx->braces)
		list_int_free(lx->braces);
	lx->braces = list_int_new();
	list_int_push(lx->braces, 0);
	lx->str_hexval = 0;
	lx->str_hexleft = 0;
}

static lex lex_new(){
	lex lx = mem_alloc(sizeof(lex_st));
	lx->str = NULL;
	lx->braces = NULL;
	lex_reset(lx);
	return lx;
}

static void lex_fwd(lex lx, filepos_st flp, char ch){
	lx->ch4 = lx->ch3;
	lx->ch3 = lx->ch2;
	lx->ch2 = lx->ch1;
	lx->ch1 = ch;
	lx->flp4 = lx->flp3;
	lx->flp3 = lx->flp2;
	lx->flp2 = lx->flp1;
	lx->flp1 = flp;
}

static void lex_rev(lex lx){
	lx->chR = lx->ch1;
	lx->ch1 = lx->ch2;
	lx->ch2 = lx->ch3;
	lx->ch3 = lx->ch4;
	lx->ch4 = 0;
	lx->flpR = lx->flp1;
	lx->flp1 = lx->flp2;
	lx->flp2 = lx->flp3;
	lx->flp3 = lx->flp4;
	lx->flp4 = FILEPOS_NULL;
}

static void lex_process(lex lx, list_ptr tks){
	char ch1 = lx->ch1;
	filepos_st flp = lx->flp1;
	filepos_st flpS = lx->flpS;

	switch (lx->state){
		case LEX_START:
			lx->flpS = flp;
			if (ch1 == '#'){
				lx->state = LEX_COMMENT_LINE;
				list_ptr_push(tks, tok_newline(flp, false));
			}
			else if (ks_char(ch1) != KS_INVALID){
				if (ch1 == '{')
					lx->braces->vals[lx->braces->size - 1]++;
				else if (ch1 == '}'){
					if (lx->braces->vals[lx->braces->size - 1] > 0)
						lx->braces->vals[lx->braces->size - 1]--;
					else if (lx->braces->size > 1){
						list_int_pop(lx->braces);
						lx->str = list_byte_new();
						lx->state = LEX_STR_INTERP;
						list_ptr_push(tks, tok_ks(flp, KS_RPAREN));
						list_ptr_push(tks, tok_ks(flp, KS_TILDE));
						break;
					}
					else
						list_ptr_push(tks, tok_error(flp, format("Mismatched brace")));
				}
				lx->state = LEX_SPECIAL1;
			}
			else if (isIdentStart(ch1)){
				lx->str = list_byte_new();
				list_byte_push(lx->str, ch1);
				lx->state = LEX_IDENT;
			}
			else if (isNum(ch1)){
				numpart_new(&lx->npi);
				lx->npi.val = toHex(ch1);
				if (lx->npi.val == 0)
					lx->state = LEX_NUM_0;
				else
					lx->state = LEX_NUM_BODY;
			}
			else if (ch1 == '\''){
				lx->str = list_byte_new();
				lx->state = LEX_STR_BASIC;
			}
			else if (ch1 == '"'){
				lx->str = list_byte_new();
				lx->state = LEX_STR_INTERP;
				list_ptr_push(tks, tok_ks(flp, KS_LPAREN));
			}
			else if (ch1 == '\\')
				lx->state = LEX_BACKSLASH;
			else if (ch1 == '\r'){
				lx->state = LEX_RETURN;
				list_ptr_push(tks, tok_newline(flp, false));
			}
			else if (ch1 == '\n' || ch1 == ';')
				list_ptr_push(tks, tok_newline(flp, ch1 == ';'));
			else if (!isSpace(ch1))
				list_ptr_push(tks, tok_error(flp, format("Unexpected character: %c", ch1)));
			break;

		case LEX_COMMENT_LINE:
			if (ch1 == '\r')
				lx->state = LEX_RETURN;
			else if (ch1 == '\n')
				lx->state = LEX_START;
			break;

		case LEX_BACKSLASH:
			if (ch1 == '#')
				lx->state = LEX_COMMENT_LINE;
			else if (ch1 == '\r')
				lx->state = LEX_RETURN;
			else if (ch1 == '\n')
				lx->state = LEX_START;
			else if (!isSpace(ch1)){
				list_ptr_push(tks,
					tok_error(flp, format("Invalid character after backslash")));
			}
			break;

		case LEX_RETURN:
			lx->state = LEX_START;
			if (ch1 != '\n')
				lex_process(lx, tks);
			break;

		case LEX_COMMENT_BLOCK:
			if (lx->ch2 == '*' && ch1 == '/')
				lx->state = LEX_START;
			break;

		case LEX_SPECIAL1:
			if (ks_char(ch1) != KS_INVALID){
				if (lx->ch2 == '/' && ch1 == '*')
					lx->state = LEX_COMMENT_BLOCK;
				else
					lx->state = LEX_SPECIAL2;
			}
			else{
				ks_enum ks1 = ks_char(lx->ch2);
				// hack to detect difference between binary and unary +/-
				if (ks1 == KS_PLUS){
					if (!isSpace(ch1) && isSpace(lx->ch3))
						ks1 = KS_UNPLUS;
				}
				else if (ks1 == KS_MINUS){
					if (!isSpace(ch1) && isSpace(lx->ch3))
						ks1 = KS_UNMINUS;
				}
				list_ptr_push(tks, tok_ks(lx->flp2, ks1));
				lx->state = LEX_START;
				lex_process(lx, tks);
			}
			break;

		case LEX_SPECIAL2: {
			ks_enum ks3 = ks_char3(lx->ch3, lx->ch2, ch1);
			if (ks3 != KS_INVALID){
				lx->state = LEX_START;
				list_ptr_push(tks, tok_ks(lx->flp3, ks3));
			}
			else{
				ks_enum ks2 = ks_char2(lx->ch3, lx->ch2);
				if (ks2 != KS_INVALID){
					list_ptr_push(tks, tok_ks(lx->flp3, ks2));
					lx->state = LEX_START;
					lex_process(lx, tks);
				}
				else{
					ks_enum ks1 = ks_char(lx->ch3);
					// hack to detect difference between binary and unary +/-
					if (ks1 == KS_PLUS && isSpace(lx->ch4))
						ks1 = KS_UNPLUS;
					else if (ks1 == KS_MINUS && isSpace(lx->ch4))
						ks1 = KS_UNMINUS;
					list_ptr_push(tks, tok_ks(lx->flp3, ks1));
					lx->state = LEX_START;
					lex_rev(lx);
					lex_process(lx, tks);
					lex_fwd(lx, lx->flpR, lx->chR);
					lex_process(lx, tks);
				}
			}
		} break;

		case LEX_IDENT:
			if (!isIdentBody(ch1)){
				ks_enum ksk = ks_str(lx->str);
				if (ksk != KS_INVALID){
					list_ptr_push(tks, tok_ks(flpS, ksk));
					list_byte_free(lx->str);
				}
				else
					list_ptr_push(tks, tok_ident(flpS, lx->str));
				lx->str = NULL;
				lx->state = LEX_START;
				lex_process(lx, tks);
			}
			else{
				list_byte_push(lx->str, ch1);
				if (lx->str->size > 1024)
					list_ptr_push(tks, tok_error(flpS, format("Identifier too long")));
			}
			break;

		case LEX_NUM_0:
			if (ch1 == 'b'){
				lx->npi.base = 2;
				lx->state = LEX_NUM_2;
			}
			else if (ch1 == 'c'){
				lx->npi.base = 8;
				lx->state = LEX_NUM_2;
			}
			else if (ch1 == 'x'){
				lx->npi.base = 16;
				lx->state = LEX_NUM_2;
			}
			else if (ch1 == '_')
				lx->state = LEX_NUM_BODY;
			else if (ch1 == '.')
				lx->state = LEX_NUM_FRAC;
			else if (ch1 == 'e' || ch1 == 'E')
				lx->state = LEX_NUM_EXP;
			else if (!isIdentStart(ch1)){
				list_ptr_push(tks, tok_num(flpS, 0));
				lx->state = LEX_START;
				lex_process(lx, tks);
			}
			else
				list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
			break;

		case LEX_NUM_2:
			if (isHex(ch1)){
				lx->npi.val = toHex(ch1);
				if (lx->npi.val >= lx->npi.base)
					list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
				else
					lx->state = LEX_NUM_BODY;
			}
			else if (ch1 != '_')
				list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
			break;

		case LEX_NUM_BODY:
			if (ch1 == '.')
				lx->state = LEX_NUM_FRAC;
			else if ((lx->npi.base == 10 && (ch1 == 'e' || ch1 == 'E')) ||
				(lx->npi.base != 10 && (ch1 == 'p' || ch1 == 'P')))
				lx->state = LEX_NUM_EXP;
			else if (isHex(ch1)){
				int v = toHex(ch1);
				if (v >= lx->npi.base)
					list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
				else
					lx->npi.val = lx->npi.val * lx->npi.base + v;
			}
			else if (!isAlpha(ch1)){
				list_ptr_push(tks, tok_num(flpS, numpart_calc(lx->npi)));
				lx->state = LEX_START;
				lex_process(lx, tks);
			}
			else if (ch1 != '_')
				list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
			break;

		case LEX_NUM_FRAC:
			if ((lx->npi.base == 10 && (ch1 == 'e' || ch1 == 'E')) ||
				(lx->npi.base != 10 && (ch1 == 'p' || ch1 == 'P')))
				lx->state = LEX_NUM_EXP;
			else if (isHex(ch1)){
				int v = toHex(ch1);
				if (v >= lx->npi.base)
					list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
				else{
					lx->npi.frac = lx->npi.frac * lx->npi.base + v;
					lx->npi.flen++;
				}
			}
			else if (!isAlpha(ch1)){
				if (lx->npi.flen <= 0)
					list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
				else{
					list_ptr_push(tks, tok_num(flpS, numpart_calc(lx->npi)));
					lx->state = LEX_START;
					lex_process(lx, tks);
				}
			}
			else if (ch1 != '_')
				list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
			break;

		case LEX_NUM_EXP:
			if (ch1 != '_'){
				lx->npi.esign = ch1 == '-' ? -1 : 1;
				lx->state = LEX_NUM_EXP_BODY;
				lx->numexp = false;
				if (ch1 != '+' && ch1 != '-')
					lex_process(lx, tks);
			}
			break;

		case LEX_NUM_EXP_BODY:
			if (isNum(ch1)){
				lx->npi.eval = lx->npi.eval * 10.0 + toHex(ch1);
				lx->numexp = true;
			}
			else if (!isAlpha(ch1)){
				if (!lx->numexp)
					list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
				else{
					list_ptr_push(tks, tok_num(flpS, numpart_calc(lx->npi)));
					lx->state = LEX_START;
					lex_process(lx, tks);
				}
			}
			else if (ch1 != '_')
				list_ptr_push(tks, tok_error(flpS, format("Invalid number")));
			break;

		case LEX_STR_BASIC:
			if (ch1 == '\r' || ch1 == '\n')
				list_ptr_push(tks, tok_error(lx->flp2, format("Missing end of string")));
			else if (ch1 == '\'')
				lx->state = LEX_STR_BASIC_ESC;
			else
				list_byte_push(lx->str, ch1);
			break;

		case LEX_STR_BASIC_ESC:
			if (ch1 == '\''){
				list_byte_push(lx->str, ch1);
				lx->state = LEX_STR_BASIC;
			}
			else{
				lx->state = LEX_START;
				list_ptr_push(tks, tok_ks(flpS, KS_LPAREN));
				list_ptr_push(tks, tok_str(flpS, lx->str));
				list_ptr_push(tks, tok_ks(lx->flp2, KS_RPAREN));
				lx->str = NULL;
				lex_process(lx, tks);
			}
			break;

		case LEX_STR_INTERP:
			if (ch1 == '\r' || ch1 == '\n')
				list_ptr_push(tks, tok_error(lx->flp2, format("Missing end of string")));
			else if (ch1 == '"'){
				lx->state = LEX_START;
				list_ptr_push(tks, tok_str(flpS, lx->str));
				list_ptr_push(tks, tok_ks(flp, KS_RPAREN));
				lx->str = NULL;
			}
			else if (ch1 == '$'){
				lx->state = LEX_STR_INTERP_DLR;
				list_ptr_push(tks, tok_str(flpS, lx->str));
				list_ptr_push(tks, tok_ks(flp, KS_TILDE));
				lx->str = NULL;
			}
			else if (ch1 == '\\')
				lx->state = LEX_STR_INTERP_ESC;
			else
				list_byte_push(lx->str, ch1);
			break;

		case LEX_STR_INTERP_DLR:
			if (ch1 == '{'){
				list_int_push(lx->braces, 0);
				lx->state = LEX_START;
				list_ptr_push(tks, tok_ks(flp, KS_LPAREN));
			}
			else if (isIdentStart(ch1)){
				lx->str = list_byte_new();
				list_byte_push(lx->str, ch1);
				lx->state = LEX_STR_INTERP_DLR_ID;
				lx->flpS = flp; // save start position of ident
			}
			else
				list_ptr_push(tks, tok_error(flp, format("Invalid substitution")));
			break;

		case LEX_STR_INTERP_DLR_ID:
			if (!isIdentBody(ch1)){
				if (ks_str(lx->str) != KS_INVALID)
					list_ptr_push(tks, tok_error(flpS, format("Invalid substitution")));
				else{
					list_ptr_push(tks, tok_ident(flpS, lx->str));
					if (ch1 == '"'){
						lx->state = LEX_START;
						lx->str = NULL;
						list_ptr_push(tks, tok_ks(flp, KS_RPAREN));
					}
					else{
						lx->str = list_byte_new();
						lx->state = LEX_STR_INTERP;
						list_ptr_push(tks, tok_ks(flp, KS_TILDE));
						lex_process(lx, tks);
					}
				}
			}
			else{
				list_byte_push(lx->str, ch1);
				if (lx->str->size > 1024)
					list_ptr_push(tks, tok_error(flpS, format("Identifier too long")));
			}
			break;

		case LEX_STR_INTERP_ESC:
			if (ch1 == '\r' || ch1 == '\n')
				list_ptr_push(tks, tok_error(lx->flp2, format("Missing end of string")));
			else if (ch1 == 'x'){
				lx->str_hexval = 0;
				lx->str_hexleft = 2;
				lx->state = LEX_STR_INTERP_ESC_HEX;
			}
			else if (ch1 == '0'){
				list_byte_push(lx->str, 0);
				lx->state = LEX_STR_INTERP;
			}
			else if (ch1 == 'b'){
				list_byte_push(lx->str, 8);
				lx->state = LEX_STR_INTERP;
			}
			else if (ch1 == 't'){
				list_byte_push(lx->str, 9);
				lx->state = LEX_STR_INTERP;
			}
			else if (ch1 == 'n'){
				list_byte_push(lx->str, 10);
				lx->state = LEX_STR_INTERP;
			}
			else if (ch1 == 'v'){
				list_byte_push(lx->str, 11);
				lx->state = LEX_STR_INTERP;
			}
			else if (ch1 == 'f'){
				list_byte_push(lx->str, 12);
				lx->state = LEX_STR_INTERP;
			}
			else if (ch1 == 'r'){
				list_byte_push(lx->str, 13);
				lx->state = LEX_STR_INTERP;
			}
			else if (ch1 == 'e'){
				list_byte_push(lx->str, 27);
				lx->state = LEX_STR_INTERP;
			}
			else if (ch1 == '\\' || ch1 == '\'' || ch1 == '"' || ch1 == '$'){
				list_byte_push(lx->str, ch1);
				lx->state = LEX_STR_INTERP;
			}
			else{
				list_ptr_push(tks,
					tok_error(flp, format("Invalid escape sequence: \\%c", ch1)));
			}
			break;

		case LEX_STR_INTERP_ESC_HEX:
			if (isHex(ch1)){
				lx->str_hexval = (lx->str_hexval << 4) + toHex(ch1);
				lx->str_hexleft--;
				if (lx->str_hexleft <= 0){
					list_byte_push(lx->str, lx->str_hexval);
					lx->state = LEX_STR_INTERP;
				}
			}
			else{
				list_ptr_push(tks,
					tok_error(flp, format("Invalid escape sequence; expecting hex value")));
			}
			break;
	}
}

static inline void lex_add(lex lx, filepos_st flp, char ch, list_ptr tks){
	lex_fwd(lx, flp, ch);
	lex_process(lx, tks);
}

static void lex_close(lex lx, filepos_st flp, list_ptr tks){
	if (lx->braces->size > 1){
		list_ptr_push(tks, tok_error(flp, format("Missing end of string")));
		return;
	}
	switch (lx->state){
		case LEX_START:
		case LEX_COMMENT_LINE:
		case LEX_BACKSLASH:
		case LEX_RETURN:
			break;

		case LEX_COMMENT_BLOCK:
			list_ptr_push(tks, tok_error(lx->flpS, format("Missing end of block comment")));
			return;

		case LEX_SPECIAL1:
			list_ptr_push(tks, tok_ks(lx->flp1, ks_char(lx->ch1)));
			break;

		case LEX_SPECIAL2: {
			ks_enum ks2 = ks_char2(lx->ch2, lx->ch1);
			if (ks2 != KS_INVALID)
				list_ptr_push(tks, tok_ks(lx->flp2, ks2));
			else{
				list_ptr_push(tks, tok_ks(lx->flp2, ks_char(lx->ch2)));
				list_ptr_push(tks, tok_ks(lx->flp1, ks_char(lx->ch1)));
			}
		} break;

		case LEX_IDENT: {
			ks_enum ksk = ks_str(lx->str);
			if (ksk != KS_INVALID){
				list_ptr_push(tks, tok_ks(lx->flpS, ksk));
				list_byte_free(lx->str);
			}
			else
				list_ptr_push(tks, tok_ident(lx->flpS, lx->str));
			lx->str = NULL;
		} break;

		case LEX_NUM_0:
			list_ptr_push(tks, tok_num(lx->flpS, 0));
			break;

		case LEX_NUM_2:
			list_ptr_push(tks, tok_error(lx->flpS, format("Invalid number")));
			break;

		case LEX_NUM_BODY:
			list_ptr_push(tks, tok_num(lx->flpS, numpart_calc(lx->npi)));
			break;

		case LEX_NUM_FRAC:
			if (lx->npi.flen <= 0)
				list_ptr_push(tks, tok_error(lx->flpS, format("Invalid number")));
			else
				list_ptr_push(tks, tok_num(lx->flpS, numpart_calc(lx->npi)));
			break;

		case LEX_NUM_EXP:
			list_ptr_push(tks, tok_error(lx->flpS, format("Invalid number")));
			break;

		case LEX_NUM_EXP_BODY:
			if (!lx->numexp)
				list_ptr_push(tks, tok_error(lx->flpS, format("Invalid number")));
			else
				list_ptr_push(tks, tok_num(lx->flpS, numpart_calc(lx->npi)));
			break;

		case LEX_STR_BASIC_ESC:
			list_ptr_push(tks, tok_ks(lx->flpS, KS_LPAREN));
			list_ptr_push(tks, tok_str(lx->flpS, lx->str));
			list_ptr_push(tks, tok_ks(flp, KS_RPAREN));
			lx->str = NULL;
			break;

		case LEX_STR_BASIC:
		case LEX_STR_INTERP:
		case LEX_STR_INTERP_DLR:
		case LEX_STR_INTERP_DLR_ID:
		case LEX_STR_INTERP_ESC:
		case LEX_STR_INTERP_ESC_HEX:
			list_ptr_push(tks, tok_error(lx->flpS, format("Missing end of string")));
			break;
	}
	list_ptr_push(tks, tok_newline(flp, false));
}

//
// expr
//

typedef enum {
	EXPR_NIL,
	EXPR_NUM,
	EXPR_STR,
	EXPR_LIST,
	EXPR_NAMES,
	EXPR_PAREN,
	EXPR_GROUP,
	EXPR_CAT,
	EXPR_PREFIX,
	EXPR_INFIX,
	EXPR_CALL,
	EXPR_INDEX,
	EXPR_SLICE
} expr_enum;

typedef struct expr_struct expr_st, *expr;
struct expr_struct {
	expr_enum type;
	filepos_st flp;
	union {
		double num;
		list_byte str;
		expr ex;
		list_ptr names;
		varloc_st vlc;
		list_ptr group;
		list_ptr cat;
		struct {
			expr ex;
			ks_enum k;
		} prefix;
		struct {
			expr left;
			expr right;
			ks_enum k;
		} infix;
		struct {
			expr cmd;
			expr params;
		} call;
		struct {
			expr obj;
			expr key;
		} index;
		struct {
			expr obj;
			expr start;
			expr len;
		} slice;
	} u;
};

static void expr_free(expr ex){
	switch (ex->type){
		case EXPR_NIL:
		case EXPR_NUM:
			break;

		case EXPR_STR:
			if (ex->u.str)
				list_byte_free(ex->u.str);
			break;

		case EXPR_LIST:
			if (ex->u.ex)
				expr_free(ex->u.ex);
			break;

		case EXPR_NAMES:
			if (ex->u.names)
				list_ptr_free(ex->u.names);
			break;

		case EXPR_PAREN:
			if (ex->u.ex)
				expr_free(ex->u.ex);
			break;

		case EXPR_GROUP:
			if (ex->u.group)
				list_ptr_free(ex->u.group);
			break;

		case EXPR_CAT:
			if (ex->u.cat)
				list_ptr_free(ex->u.cat);
			break;

		case EXPR_PREFIX:
			if (ex->u.prefix.ex)
				expr_free(ex->u.prefix.ex);
			break;

		case EXPR_INFIX:
			if (ex->u.infix.left)
				expr_free(ex->u.infix.left);
			if (ex->u.infix.right)
				expr_free(ex->u.infix.right);
			break;

		case EXPR_CALL:
			if (ex->u.call.cmd)
				expr_free(ex->u.call.cmd);
			if (ex->u.call.params)
				expr_free(ex->u.call.params);
			break;

		case EXPR_INDEX:
			if (ex->u.index.obj)
				expr_free(ex->u.index.obj);
			if (ex->u.index.key)
				expr_free(ex->u.index.key);
			break;

		case EXPR_SLICE:
			if (ex->u.slice.obj)
				expr_free(ex->u.slice.obj);
			if (ex->u.slice.start)
				expr_free(ex->u.slice.start);
			if (ex->u.slice.len)
				expr_free(ex->u.slice.len);
			break;
	}
	mem_free(ex);
}

#ifdef SINK_DEBUG
static void expr_print(expr ex, int depth){
	char *tab = mem_alloc(sizeof(char) * (depth * 2 + 1));
	for (int i = 0; i < depth * 2; i++)
		tab[i] = ' ';
	tab[depth * 2] = 0;
	switch (ex->type){
		case EXPR_NIL:
			debugf("%sEXPR_NIL %d:%d", tab, ex->flp.line, ex->flp.chr);
			break;

		case EXPR_NUM:
			debugf("%sEXPR_NUM %d:%d %g", tab, ex->flp.line, ex->flp.chr, ex->u.num);
			break;

		case EXPR_STR:
			if (ex->u.str){
				debugf("%sEXPR_STR %d:%d \"%.*s\"", tab, ex->flp.line, ex->flp.chr,
					ex->u.str->size, ex->u.str->bytes);
			}
			else
				debugf("%sEXPR_STR %d:%d NULL", tab, ex->flp.line, ex->flp.chr);
			break;

		case EXPR_LIST:
			if (ex->u.ex){
				debugf("%sEXPR_LIST:", tab);
				expr_print(ex->u.ex, depth + 1);
			}
			else
				debugf("%sEXPR_LIST NULL", tab);
			break;

		case EXPR_NAMES:
			if (ex->u.names){
				debugf("%sEXPR_NAMES: %d:%d", tab, ex->flp.line, ex->flp.chr);
				for (int i = 0; i < ex->u.names->size; i++){
					list_byte b = ex->u.names->ptrs[i];
					debugf("%s  \"%.*s\"", tab, b->size, b->bytes);
				}
			}
			else
				debugf("%sEXPR_NAMES NULL", tab);
			break;

		case EXPR_PAREN:
			if (ex->u.ex){
				debugf("%sEXPR_PAREN:", tab);
				expr_print(ex->u.ex, depth + 1);
			}
			else
				debugf("%sEXPR_PAREN NULL", tab);
			break;

		case EXPR_GROUP:
			if (ex->u.group){
				debugf("%sEXPR_GROUP:", tab);
				for (int i = 0; i < ex->u.group->size; i++)
					expr_print(ex->u.group->ptrs[i], depth + 1);
			}
			else
				debugf("%sEXPR_GROUP NULL", tab);
			break;

		case EXPR_CAT:
			if (ex->u.cat){
				debugf("%sEXPR_CAT:", tab);
				for (int i = 0; i < ex->u.cat->size; i++)
					expr_print(ex->u.cat->ptrs[i], depth + 1);
			}
			else
				debugf("%sEXPR_CAT NULL", tab);
			break;

		case EXPR_PREFIX:
			if (ex->u.prefix.ex){
				debugf("%sEXPR_PREFIX %s:", tab, ks_name(ex->u.prefix.k));
				expr_print(ex->u.prefix.ex, depth + 1);
			}
			else
				debugf("%sEXPR_PREFIX %s NULL", tab, ks_name(ex->u.prefix.k));
			break;

		case EXPR_INFIX:
			debugf("%sEXPR_INFIX: %d:%d", tab, ex->flp.line, ex->flp.chr);
			if (ex->u.infix.left)
				expr_print(ex->u.infix.left, depth + 1);
			else
				debugf("%s  NULL", tab);
			debugf("%s->%s", tab, ks_name(ex->u.infix.k));
			if (ex->u.infix.right)
				expr_print(ex->u.infix.right, depth + 1);
			else
				debugf("%s  NULL", tab);
			break;

		case EXPR_CALL:
			debugf("%sEXPR_CALL:", tab);
			if (ex->u.call.cmd)
				expr_print(ex->u.call.cmd, depth + 1);
			else
				debugf("%s  NULL", tab);
			debugf("%s->", tab);
			if (ex->u.call.params)
				expr_print(ex->u.call.params, depth + 1);
			else
				debugf("%s  NULL", tab);
			break;

		case EXPR_INDEX:
			debugf("%sEXPR_INDEX:", tab);
			if (ex->u.index.obj)
				expr_print(ex->u.index.obj, depth + 1);
			else
				debugf("%s  NULL", tab);
			debugf("%s->", tab);
			if (ex->u.index.key)
				expr_print(ex->u.index.key, depth + 1);
			else
				debugf("%s  NULL", tab);
			break;

		case EXPR_SLICE:
			debugf("%sEXPR_SLICE:", tab);
			if (ex->u.slice.obj)
				expr_print(ex->u.slice.obj, depth + 1);
			else
				debugf("%s  NULL", tab);
			debugf("%s->", tab);
			if (ex->u.slice.start)
				expr_print(ex->u.slice.start, depth + 1);
			else
				debugf("%s  NULL", tab);
			debugf("%s->", tab);
			if (ex->u.slice.len)
				expr_print(ex->u.slice.len, depth + 1);
			else
				debugf("%s  NULL", tab);
			break;
	}
	mem_free(tab);
}
#endif

static inline expr expr_nil(filepos_st flp){
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_NIL;
	return ex;
}

static inline expr expr_num(filepos_st flp, double num){
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_NUM;
	ex->u.num = num;
	return ex;
}

static inline expr expr_str(filepos_st flp, list_byte str){
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_STR;
	ex->u.str = str;
	return ex;
}

static inline expr expr_list(filepos_st flp, expr ex){
	expr ex2 = mem_alloc(sizeof(expr_st));
	ex2->flp = flp;
	ex2->type = EXPR_LIST;
	ex2->u.ex = ex;
	return ex2;
}

static inline expr expr_names(filepos_st flp, list_ptr names){
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_NAMES;
	ex->u.names = names;
	return ex;
}

static inline expr expr_paren(filepos_st flp, expr ex){
	if (ex->type == EXPR_NUM)
		return ex;
	expr ex2 = mem_alloc(sizeof(expr_st));
	ex2->flp = flp;
	ex2->type = EXPR_PAREN;
	ex2->u.ex = ex;
	return ex2;
}

static inline expr expr_group(filepos_st flp, expr left, expr right){
	list_ptr g = list_ptr_new(expr_free);
	if (left->type == EXPR_GROUP){
		list_ptr_append(g, left->u.group);
		left->u.group->size = 0;
		expr_free(left);
	}
	else
		list_ptr_push(g, left);
	if (right->type == EXPR_GROUP){
		list_ptr_append(g, right->u.group);
		right->u.group->size = 0;
		expr_free(right);
	}
	else
		list_ptr_push(g, right);
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_GROUP;
	ex->u.group = g;
	return ex;
}

static inline expr expr_cat(filepos_st flp, expr left, expr right){
	// unwrap any parens
	while (left->type == EXPR_PAREN){
		expr lf = left->u.ex;
		left->u.ex = NULL;
		expr_free(left);
		left = lf;
	}
	while (right->type == EXPR_PAREN){
		expr rt = right->u.ex;
		right->u.ex = NULL;
		expr_free(right);
		right = rt;
	}

	// check for static concat
	if (left->type == EXPR_STR && right->type == EXPR_STR){
		list_byte_append(left->u.str, right->u.str->size, right->u.str->bytes);
		list_byte_null(left->u.str);
		expr_free(right);
		return left;
	}
	else if (left->type == EXPR_LIST && right->type == EXPR_LIST){
		if (right->u.ex){
			if (left->u.ex)
				left->u.ex = expr_group(flp, left->u.ex, right->u.ex);
			else
				left->u.ex = right->u.ex;
			right->u.ex = NULL;
		}
		expr_free(right);
		return left;
	}

	list_ptr c = list_ptr_new(expr_free);
	if (left->type == EXPR_CAT){
		list_ptr_append(c, left->u.cat);
		left->u.cat->size = 0;
		expr_free(left);
	}
	else
		list_ptr_push(c, left);
	if (right->type == EXPR_CAT){
		list_ptr_append(c, right->u.cat);
		right->u.cat->size = 0;
		expr_free(right);
	}
	else
		list_ptr_push(c, right);
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_CAT;
	ex->u.cat = c;
	return ex;
}

static inline expr expr_prefix(filepos_st flp, ks_enum k, expr ex){
	if ((k == KS_MINUS || k == KS_UNMINUS) && ex->type == EXPR_NUM){
		ex->u.num = -ex->u.num;
		return ex;
	}
	else if ((k == KS_PLUS || k == KS_UNPLUS) && ex->type == EXPR_NUM)
		return ex;
	expr ex2 = mem_alloc(sizeof(expr_st));
	ex2->flp = flp;
	ex2->type = EXPR_PREFIX;
	ex2->u.prefix.k = k;
	ex2->u.prefix.ex = ex;
	return ex2;
}

static inline expr expr_infix(filepos_st flp, ks_enum k, expr left, expr right){
	if (left->type == EXPR_NUM && right->type == EXPR_NUM){
		// check for compile-time numeric optimizations
		if (k == KS_PLUS){
			left->u.num += right->u.num;
			expr_free(right);
			return left;
		}
		else if (k == KS_MINUS){
			left->u.num -= right->u.num;
			expr_free(right);
			return left;
		}
		else if (k == KS_PERCENT){
			left->u.num = fmod(left->u.num, right->u.num);
			expr_free(right);
			return left;
		}
		else if (k == KS_STAR){
			left->u.num *= right->u.num;
			expr_free(right);
			return left;
		}
		else if (k == KS_SLASH){
			left->u.num /= right->u.num;
			expr_free(right);
			return left;
		}
		else if (k == KS_CARET){
			left->u.num = pow(left->u.num, right->u.num);
			expr_free(right);
			return left;
		}
	}
	if (k == KS_COMMA)
		return expr_group(flp, left, right);
	else if (k == KS_TILDE)
		return expr_cat(flp, left, right);
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_INFIX;
	ex->u.infix.k = k;
	ex->u.infix.left = left;
	ex->u.infix.right = right;
	return ex;
}

static inline expr expr_call(filepos_st flp, expr cmd, expr params){
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_CALL;
	ex->u.call.cmd = cmd;
	ex->u.call.params = params;
	return ex;
}

static inline expr expr_index(filepos_st flp, expr obj, expr key){
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_INDEX;
	ex->u.index.obj = obj;
	ex->u.index.key = key;
	return ex;
}

static inline expr expr_slice(filepos_st flp, expr obj, expr start, expr len){
	expr ex = mem_alloc(sizeof(expr_st));
	ex->flp = flp;
	ex->type = EXPR_SLICE;
	ex->u.slice.obj = obj;
	ex->u.slice.start = start;
	ex->u.slice.len = len;
	return ex;
}

//
// ast
//

typedef struct {
	bool local;
	filepos_st flp; // location of names
	list_ptr names;
	list_byte key;
} decl_st, *decl;

static inline void decl_free(decl dc){
	if (dc->names)
		list_ptr_free(dc->names);
	if (dc->key)
		list_byte_free(dc->key);
	mem_free(dc);
}

static inline decl decl_local(filepos_st flp, list_ptr names){
	decl dc = mem_alloc(sizeof(decl_st));
	dc->local = true;
	dc->flp = flp;
	dc->names = names;
	dc->key = NULL;
	return dc;
}

static inline decl decl_native(filepos_st flp, list_ptr names, list_byte key){
	decl dc = mem_alloc(sizeof(decl_st));
	dc->local = false;
	dc->flp = flp;
	dc->names = names;
	dc->key = key;
	return dc;
}

typedef enum {
	AST_BREAK,
	AST_CONTINUE,
	AST_DECLARE,
	AST_DEF1,
	AST_DEF2,
	AST_DOWHILE1,
	AST_DOWHILE2,
	AST_DOWHILE3,
	AST_ENUM,
	AST_FOR1,
	AST_FOR2,
	AST_LOOP1,
	AST_LOOP2,
	AST_GOTO,
	AST_IF1,
	AST_IF2,
	AST_IF3,
	AST_IF4,
	AST_INCLUDE,
	AST_NAMESPACE1,
	AST_NAMESPACE2,
	AST_RETURN,
	AST_USING,
	AST_VAR,
	AST_EVAL,
	AST_LABEL
} ast_enumt;

typedef struct {
	ast_enumt type;
	filepos_st flp;
	union {
		decl declare;
		expr cond;
		list_ptr lvalues;
		list_byte ident;
		list_ptr incls;
		list_ptr names;
		expr ex;
		struct {
			filepos_st flpN;
			list_ptr names;
			list_ptr lvalues;
		} def1;
		struct {
			list_ptr names1;
			list_ptr names2;
			expr ex;
			bool forVar;
		} for1;
	} u;
} ast_st, *ast;

static void ast_free(ast stmt){
	switch (stmt->type){
		case AST_BREAK:
		case AST_CONTINUE:
			break;

		case AST_DECLARE:
			if (stmt->u.declare)
				decl_free(stmt->u.declare);
			break;

		case AST_DEF1:
			if (stmt->u.def1.names)
				list_ptr_free(stmt->u.def1.names);
			if (stmt->u.def1.lvalues)
				list_ptr_free(stmt->u.def1.lvalues);
			break;

		case AST_DEF2:
			break;

		case AST_DOWHILE1:
			break;

		case AST_DOWHILE2:
			if (stmt->u.cond)
				expr_free(stmt->u.cond);
			break;

		case AST_DOWHILE3:
			break;

		case AST_ENUM:
			if (stmt->u.lvalues)
				list_ptr_free(stmt->u.lvalues);
			break;

		case AST_FOR1:
			if (stmt->u.for1.names1)
				list_ptr_free(stmt->u.for1.names1);
			if (stmt->u.for1.names2)
				list_ptr_free(stmt->u.for1.names2);
			if (stmt->u.for1.ex)
				expr_free(stmt->u.for1.ex);
			break;

		case AST_FOR2:
		case AST_LOOP1:
		case AST_LOOP2:
			break;

		case AST_GOTO:
			if (stmt->u.ident)
				list_byte_free(stmt->u.ident);
			break;

		case AST_IF1:
			break;

		case AST_IF2:
			if (stmt->u.cond)
				expr_free(stmt->u.cond);
			break;

		case AST_IF3:
		case AST_IF4:
			break;

		case AST_INCLUDE:
			if (stmt->u.incls)
				list_ptr_free(stmt->u.incls);
			break;

		case AST_NAMESPACE1:
			if (stmt->u.names)
				list_ptr_free(stmt->u.names);
			break;

		case AST_NAMESPACE2:
			break;

		case AST_RETURN:
			if (stmt->u.ex)
				expr_free(stmt->u.ex);
			break;

		case AST_USING:
			if (stmt->u.names)
				list_ptr_free(stmt->u.names);
			break;

		case AST_VAR:
			if (stmt->u.lvalues)
				list_ptr_free(stmt->u.lvalues);
			break;

		case AST_EVAL:
			if (stmt->u.ex)
				expr_free(stmt->u.ex);
			break;

		case AST_LABEL:
			if (stmt->u.ident)
				list_byte_free(stmt->u.ident);
			break;
	}
	mem_free(stmt);
}

static void ast_print(ast stmt){
	#ifdef SINK_DEBUG
	switch (stmt->type){
		case AST_BREAK:
			debug("AST_BREAK");
			break;

		case AST_CONTINUE:
			debug("AST_CONTINUE");
			break;

		case AST_DECLARE:
			//if (stmt->u.declare)
			debug("AST_DECLARE");
			break;

		case AST_DEF1:
			//if (stmt->u.def1.names)
			//if (stmt->u.def1.lvalues)
			debug("AST_DEF1");
			break;

		case AST_DEF2:
			debug("AST_DEF2");
			break;

		case AST_DOWHILE1:
			debug("AST_DOWHILE1");
			break;

		case AST_DOWHILE2:
			debug("AST_DOWHILE2:");
			if (stmt->u.cond)
				expr_print(stmt->u.cond, 1);
			else
				debug("  NULL");
			break;

		case AST_DOWHILE3:
			debug("AST_DOWHILE3");
			break;

		case AST_ENUM:
			debug("AST_ENUM");
			break;

		case AST_FOR1:
			//if (stmt->u.afor.names1)
			//if (stmt->u.afor.names2)
			debug("AST_FOR:");
			if (stmt->u.for1.ex)
				expr_print(stmt->u.for1.ex, 1);
			else
				debug("  NULL");
			break;

		case AST_FOR2:
			debug("AST_FOR2");
			break;

		case AST_LOOP1:
			debug("AST_LOOP1");
			break;

		case AST_LOOP2:
			debug("AST_LOOP2");
			break;

		case AST_GOTO:
			if (stmt->u.ident)
				debugf("AST_GOTO \"%.*s\"", stmt->u.ident->size, stmt->u.ident->bytes);
			else
				debug("AST_GOTO NULL");
			break;

		case AST_IF1:
			debug("AST_IF1");
			break;

		case AST_IF2:
			//if (stmt->u.aif.conds)
			debug("AST_IF2:");
			if (stmt->u.cond)
				expr_print(stmt->u.cond, 1);
			else
				debug("  NULL");
			break;

		case AST_IF3:
			debug("AST_IF3");
			break;

		case AST_IF4:
			debug("AST_IF4");
			break;

		case AST_INCLUDE:
			//if (stmt->u.incls)
			debug("AST_INCLUDE");
			break;

		case AST_NAMESPACE1:
			//if (stmt->u.names)
			debug("AST_NAMESPACE1");
			break;

		case AST_NAMESPACE2:
			debug("AST_NAMESPACE2");
			break;

		case AST_RETURN:
			debug("AST_RETURN:");
			if (stmt->u.ex)
				expr_print(stmt->u.ex, 1);
			else
				debug("  NULL");
			break;

		case AST_USING:
			//if (stmt->u.names)
			debug("AST_USING");
			break;

		case AST_VAR:
			debug("AST_VAR:");
			if (stmt->u.lvalues){
				for (int i = 0 ;i < stmt->u.lvalues->size; i++)
					expr_print(stmt->u.lvalues->ptrs[i], 1);
			}
			else
				debug("  NULL");
			break;

		case AST_EVAL:
			debugf("AST_EVAL: %d:%d", stmt->flp.line, stmt->flp.chr);
			if (stmt->u.ex)
				expr_print(stmt->u.ex, 1);
			else
				debug("  NULL");
			break;

		case AST_LABEL:
			if (stmt->u.ident)
				debugf("AST_LABEL \"%.*s\"", stmt->u.ident->size, stmt->u.ident->bytes);
			else
				debug("AST_LABEL NULL");
			break;
	}
	#endif
}

static inline ast ast_break(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_BREAK;
	return stmt;
}

static inline ast ast_continue(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_CONTINUE;
	return stmt;
}

static inline ast ast_declare(filepos_st flp, decl dc){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_DECLARE;
	stmt->u.declare = dc;
	return stmt;
}

static inline ast ast_def1(filepos_st flp, filepos_st flpN, list_ptr names, list_ptr lvalues){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_DEF1;
	stmt->u.def1.flpN = flpN;
	stmt->u.def1.names = names;
	stmt->u.def1.lvalues = lvalues;
	return stmt;
}

static inline ast ast_def2(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_DEF2;
	return stmt;
}

static inline ast ast_dowhile1(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_DOWHILE1;
	return stmt;
}

static inline ast ast_dowhile2(filepos_st flp, expr cond){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_DOWHILE2;
	stmt->u.cond = cond;
	return stmt;
}

static inline ast ast_dowhile3(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_DOWHILE3;
	return stmt;
}

static inline ast ast_enum(filepos_st flp, list_ptr lvalues){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_ENUM;
	stmt->u.lvalues = lvalues;
	return stmt;
}

static inline ast ast_for1(filepos_st flp, bool forVar, list_ptr names1, list_ptr names2, expr ex){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_FOR1;
	stmt->u.for1.forVar = forVar;
	stmt->u.for1.names1 = names1;
	stmt->u.for1.names2 = names2;
	stmt->u.for1.ex = ex;
	return stmt;
}

static inline ast ast_for2(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_FOR2;
	return stmt;
}

static inline ast ast_loop1(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_LOOP1;
	return stmt;
}

static inline ast ast_loop2(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_LOOP2;
	return stmt;
}

static inline ast ast_goto(filepos_st flp, list_byte ident){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_GOTO;
	stmt->u.ident = ident;
	return stmt;
}

static inline ast ast_if1(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_IF1;
	return stmt;
}

static inline ast ast_if2(filepos_st flp, expr cond){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_IF2;
	stmt->u.cond = cond;
	return stmt;
}

static inline ast ast_if3(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_IF3;
	return stmt;
}

static inline ast ast_if4(filepos_st flp){
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_IF4;
	return stmt;
}

// the `names` field in `incl_st` can be INCL_UNIQUE to indicate:  include + 'foo'
#define INCL_UNIQUE  ((void *)1)

typedef struct {
	list_ptr names;
	list_byte file;
} incl_st, *incl;

static void incl_free(incl inc){
	if (inc->names && inc->names != INCL_UNIQUE)
		list_ptr_free(inc->names);
	if (inc->file)
		list_byte_free(inc->file);
	mem_free(inc);
}

static inline incl incl_new(list_ptr names, list_byte file){
	incl inc = mem_alloc(sizeof(incl_st));
	inc->names = names;
	inc->file = file;
	return inc;
}

static inline ast ast_include(filepos_st flp, list_ptr incls){
	assertflp(flp);
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_INCLUDE;
	stmt->u.incls = incls;
	return stmt;
}

static inline ast ast_namespace1(filepos_st flp, list_ptr names){
	assertflp(flp);
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_NAMESPACE1;
	stmt->u.names = names;
	return stmt;
}

static inline ast ast_namespace2(filepos_st flp){
	assertflp(flp);
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_NAMESPACE2;
	return stmt;
}

static inline ast ast_return(filepos_st flp, expr ex){
	assertflp(flp);
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_RETURN;
	stmt->u.ex = ex;
	return stmt;
}

static inline ast ast_using(filepos_st flp, list_ptr names){
	assertflp(flp);
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_USING;
	stmt->u.names = names;
	return stmt;
}

static inline ast ast_var(filepos_st flp, list_ptr lvalues){
	assertflp(flp);
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_VAR;
	stmt->u.lvalues = lvalues;
	return stmt;
}

static inline ast ast_eval(filepos_st flp, expr ex){
	assertflp(flp);
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_EVAL;
	stmt->u.ex = ex;
	return stmt;
}

static inline ast ast_label(filepos_st flp, list_byte ident){
	assertflp(flp);
	ast stmt = mem_alloc(sizeof(ast_st));
	stmt->flp = flp;
	stmt->type = AST_LABEL;
	stmt->u.ident = ident;
	return stmt;
}

//
// parser state helpers
//

typedef struct ets_struct ets_st, *ets;
struct ets_struct {
	tok tk;
	ets next;
};

static inline void ets_free(ets e){
	if (e->tk)
		tok_free(e->tk);
	mem_free(e);
}

static inline ets ets_new(tok tk, ets next){ // exprPreStack, exprMidStack
	ets e = mem_alloc(sizeof(ets_st));
	e->tk = tk;
	e->next = next;
	return e;
}

typedef struct exs_struct exs_st, *exs;
struct exs_struct {
	expr ex;
	exs next;
};

static inline void exs_free(exs e){
	if (e->ex)
		expr_free(e->ex);
	mem_free(e);
}

static inline exs exs_new(expr ex, exs next){ // exprStack
	exs e = mem_alloc(sizeof(exs_st));
	e->ex = ex;
	e->next = next;
	return e;
}

typedef struct eps_struct eps_st, *eps;
struct eps_struct {
	ets e;
	eps next;
};

static inline void eps_free(eps e){
	ets here = e->e;
	while (here){
		ets del = here;
		here = here->next;
		ets_free(del);
	}
	mem_free(e);
}

static inline eps eps_new(ets e, eps next){ // exprPreStackStack
	eps e2 = mem_alloc(sizeof(eps_st));
	e2->e = e;
	e2->next = next;
	return e2;
}

//
// parser state
//

typedef enum {
	PRS_STATEMENT,
	PRS_STATEMENT_END,
	PRS_LOOKUP,
	PRS_LOOKUP_IDENT,
	PRS_BODY,
	PRS_BODY_STATEMENT,
	PRS_LVALUES,
	PRS_LVALUES_TERM,
	PRS_LVALUES_TERM_LOOKUP,
	PRS_LVALUES_TERM_LIST,
	PRS_LVALUES_TERM_LIST_TERM_DONE,
	PRS_LVALUES_TERM_LIST_TAIL,
	PRS_LVALUES_TERM_LIST_TAIL_LOOKUP,
	PRS_LVALUES_TERM_LIST_TAIL_DONE,
	PRS_LVALUES_TERM_LIST_DONE,
	PRS_LVALUES_TERM_DONE,
	PRS_LVALUES_TERM_EXPR,
	PRS_LVALUES_MORE,
	PRS_LVALUES_DEF_TAIL,
	PRS_LVALUES_DEF_TAIL_DONE,
	PRS_BREAK,
	PRS_CONTINUE,
	PRS_DECLARE,
	PRS_DECLARE_LOOKUP,
	PRS_DECLARE_STR,
	PRS_DECLARE_STR2,
	PRS_DECLARE_STR3,
	PRS_DEF,
	PRS_DEF_LOOKUP,
	PRS_DEF_LVALUES,
	PRS_DEF_BODY,
	PRS_DO,
	PRS_DO_BODY,
	PRS_DO_WHILE_EXPR,
	PRS_DO_WHILE_BODY,
	PRS_FOR,
	PRS_LOOP_BODY,
	PRS_FOR_VARS,
	PRS_FOR_VARS_LOOKUP,
	PRS_FOR_VARS2,
	PRS_FOR_VARS2_LOOKUP,
	PRS_FOR_VARS_DONE,
	PRS_FOR_EXPR,
	PRS_FOR_BODY,
	PRS_GOTO,
	PRS_IF,
	PRS_IF2,
	PRS_IF_EXPR,
	PRS_IF_BODY,
	PRS_ELSE_BODY,
	PRS_INCLUDE,
	PRS_INCLUDE_LOOKUP,
	PRS_INCLUDE_STR,
	PRS_INCLUDE_STR2,
	PRS_INCLUDE_STR3,
	PRS_NAMESPACE,
	PRS_NAMESPACE_LOOKUP,
	PRS_NAMESPACE_BODY,
	PRS_RETURN,
	PRS_RETURN_DONE,
	PRS_USING,
	PRS_USING_LOOKUP,
	PRS_VAR,
	PRS_VAR_LVALUES,
	PRS_IDENTS,
	PRS_ENUM,
	PRS_ENUM_LVALUES,
	PRS_EVAL,
	PRS_EVAL_EXPR,
	PRS_EXPR,
	PRS_EXPR_PRE,
	PRS_EXPR_TERM,
	PRS_EXPR_TERM_ISEMPTYLIST,
	PRS_EXPR_TERM_CLOSEBRACE,
	PRS_EXPR_TERM_CLOSEPAREN,
	PRS_EXPR_TERM_LOOKUP,
	PRS_EXPR_POST,
	PRS_EXPR_POST_CALL,
	PRS_EXPR_INDEX_CHECK,
	PRS_EXPR_INDEX_COLON_CHECK,
	PRS_EXPR_INDEX_COLON_EXPR,
	PRS_EXPR_INDEX_EXPR_CHECK,
	PRS_EXPR_INDEX_EXPR_COLON_CHECK,
	PRS_EXPR_INDEX_EXPR_COLON_EXPR,
	PRS_EXPR_COMMA,
	PRS_EXPR_MID,
	PRS_EXPR_FINISH
} prs_enum;

typedef enum {
	LVM_VAR,
	LVM_DEF,
	LVM_ENUM,
	LVM_LIST
} lvm_enum;

typedef struct prs_struct prs_st, *prs;
struct prs_struct {
	prs_enum state;
	list_ptr lvalues;
	lvm_enum lvaluesMode;
	bool forVar;
	list_byte str;
	filepos_st flpS; // statment flp
	filepos_st flpL; // lookup flp
	filepos_st flpE; // expr flp
	bool exprAllowComma;
	bool exprAllowPipe;
	bool exprAllowTrailComma;
	eps exprPreStackStack;
	ets exprPreStack;
	ets exprMidStack;
	exs exprStack;
	expr exprTerm;
	expr exprTerm2;
	expr exprTerm3;
	list_ptr names; // can be INCL_UNIQUE
	list_ptr names2;
	list_ptr incls;
	prs next;
};

static void prs_free(prs pr){
	if (pr->lvalues)
		list_ptr_free(pr->lvalues);
	if (pr->str)
		list_byte_free(pr->str);
	if (pr->exprPreStackStack){
		eps here = pr->exprPreStackStack;
		while (here){
			eps del = here;
			here = here->next;
			eps_free(del);
		}
	}
	if (pr->exprPreStack){
		ets here = pr->exprPreStack;
		while (here){
			ets del = here;
			here = here->next;
			ets_free(del);
		}
	}
	if (pr->exprMidStack){
		ets here = pr->exprMidStack;
		while (here){
			ets del = here;
			here = here->next;
			ets_free(del);
		}
	}
	if (pr->exprStack){
		exs here = pr->exprStack;
		while (here){
			exs del = here;
			here = here->next;
			exs_free(del);
		}
	}
	if (pr->exprTerm)
		expr_free(pr->exprTerm);
	if (pr->exprTerm2)
		expr_free(pr->exprTerm2);
	if (pr->exprTerm3)
		expr_free(pr->exprTerm3);
	if (pr->names && pr->names != INCL_UNIQUE)
		list_ptr_free(pr->names);
	if (pr->names2)
		list_ptr_free(pr->names2);
	if (pr->incls)
		list_ptr_free(pr->incls);
	mem_free(pr);
}

static prs prs_new(prs_enum state, prs next){
	prs pr = mem_alloc(sizeof(prs_st));
	pr->state = state;
	pr->lvalues = NULL;              // list of expr
	pr->lvaluesMode = LVM_VAR;
	pr->forVar = false;
	pr->str = NULL;
	pr->flpS = FILEPOS_NULL;
	pr->flpL = FILEPOS_NULL;
	pr->flpE = FILEPOS_NULL;
	pr->exprAllowComma = true;
	pr->exprAllowPipe = true;
	pr->exprAllowTrailComma = false;
	pr->exprPreStackStack = NULL;    // linked list of eps_new's
	pr->exprPreStack = NULL;         // linked list of ets_new's
	pr->exprMidStack = NULL;         // linked list of ets_new's
	pr->exprStack = NULL;            // linked list of exs_new's
	pr->exprTerm = NULL;             // expr
	pr->exprTerm2 = NULL;            // expr
	pr->exprTerm3 = NULL;            // expr
	pr->names = NULL;                // list of strings
	pr->names2 = NULL;               // list of strings
	pr->incls = NULL;                // list of incl's
	pr->next = next;
	return pr;
}

//
// parser
//

typedef struct {
	prs state;
	tok tkR;
	tok tk1;
	tok tk2;
	int level;
} parser_st, *parser;

static inline void parser_free(parser pr){
	prs here = pr->state;
	while (here){
		prs del = here;
		here = here->next;
		prs_free(del);
	}
	if (pr->tk1)
		tok_free(pr->tk1);
	if (pr->tk2)
		tok_free(pr->tk2);
	if (pr->tkR)
		tok_free(pr->tkR);
	mem_free(pr);
}

static inline parser parser_new(){
	parser pr = mem_alloc(sizeof(parser_st));
	pr->state = prs_new(PRS_STATEMENT, NULL);
	pr->tkR = NULL;
	pr->tk1 = NULL;
	pr->tk2 = NULL;
	pr->level = 0;
	return pr;
}

static inline void parser_fwd(parser pr, tok tk){
	if (pr->tk2)
		tok_free(pr->tk2);
	pr->tk2 = pr->tk1;
	pr->tk1 = tk;
	pr->tkR = NULL;
}

static inline void parser_rev(parser pr){
	if (pr->tkR)
		tok_free(pr->tkR);
	pr->tkR = pr->tk1;
	pr->tk1 = pr->tk2;
	pr->tk2 = NULL;
}

static inline void parser_push(parser pr, prs_enum state){
	pr->state = prs_new(state, pr->state);
}

static inline void parser_pop(parser pr){
	prs p = pr->state;
	pr->state = p->next;
	prs_free(p);
}

typedef struct {
	bool ok;
	union {
		expr ex;
		const char *msg;
	} u;
} pri_st;

static inline pri_st pri_ok(expr ex){
	return (pri_st){ .ok = true, .u.ex = ex };
}

static inline pri_st pri_error(char *msg){
	return (pri_st){ .ok = false, .u.msg = msg };
}

static inline pri_st parser_infix(filepos_st flp, ks_enum k, expr left, expr right){
	if (k == KS_PIPE){
		if (right->type == EXPR_CALL){
			right->u.call.params = expr_infix(flp, KS_COMMA, expr_paren(left->flp, left),
				right->u.call.params);
			return pri_ok(right);
		}
		else if (right->type == EXPR_NAMES)
			return pri_ok(expr_call(right->flp, right, expr_paren(left->flp, left)));
		return pri_error("Invalid pipe");
	}
	return pri_ok(expr_infix(flp, k, left, right));
}

static inline void parser_lvalues(parser pr, prs_enum retstate, lvm_enum lvm){
	pr->state->state = retstate;
	parser_push(pr, PRS_LVALUES);
	pr->state->lvalues = list_ptr_new(expr_free);
	pr->state->lvaluesMode = lvm;
}

static inline void parser_expr(parser pr, prs_enum retstate){
	pr->state->state = retstate;
	parser_push(pr, PRS_EXPR);
}

static inline const char *parser_start(parser pr, filepos_st flpS, prs_enum state){
	pr->level++;
	pr->state->state = state;
	pr->state->flpS = flpS;
	return NULL;
}

// returns NULL for success, or an error message
static const char *parser_process(parser pr, list_ptr stmts);

static inline const char *parser_statement(parser pr, list_ptr stmts, bool more){
	pr->level--;
	pr->state->state = PRS_STATEMENT_END;
	return more ? NULL : parser_process(pr, stmts);
}

static inline const char *parser_lookup(parser pr, filepos_st flpL, prs_enum retstate){
	pr->state->state = retstate;
	pr->state->flpL = flpL;
	parser_push(pr, PRS_LOOKUP);
	pr->state->names = list_ptr_new(list_byte_free);
	list_ptr_push(pr->state->names, pr->tk1->u.ident);
	pr->tk1->u.ident = NULL;
	return NULL;
}

static const char *parser_process(parser pr, list_ptr stmts){
	tok tk1 = pr->tk1;
	prs st = pr->state;
	filepos_st flpT = tk1->flp;
	filepos_st flpS = st->flpS;
	filepos_st flpL = st->flpL;
	filepos_st flpE = st->flpE;
	switch (st->state){
		case PRS_STATEMENT:
			if      (tk1->type == TOK_NEWLINE   ) return NULL;
			else if (tok_isKS(tk1, KS_BREAK    )) return parser_start(pr, flpT, PRS_BREAK    );
			else if (tok_isKS(tk1, KS_CONTINUE )) return parser_start(pr, flpT, PRS_CONTINUE );
			else if (tok_isKS(tk1, KS_DECLARE  )) return parser_start(pr, flpT, PRS_DECLARE  );
			else if (tok_isKS(tk1, KS_DEF      )) return parser_start(pr, flpT, PRS_DEF      );
			else if (tok_isKS(tk1, KS_DO       )) return parser_start(pr, flpT, PRS_DO       );
			else if (tok_isKS(tk1, KS_ENUM     )) return parser_start(pr, flpT, PRS_ENUM     );
			else if (tok_isKS(tk1, KS_FOR      )) return parser_start(pr, flpT, PRS_FOR      );
			else if (tok_isKS(tk1, KS_GOTO     )) return parser_start(pr, flpT, PRS_GOTO     );
			else if (tok_isKS(tk1, KS_IF       )) return parser_start(pr, flpT, PRS_IF       );
			else if (tok_isKS(tk1, KS_INCLUDE  )) return parser_start(pr, flpT, PRS_INCLUDE  );
			else if (tok_isKS(tk1, KS_NAMESPACE)) return parser_start(pr, flpT, PRS_NAMESPACE);
			else if (tok_isKS(tk1, KS_RETURN   )) return parser_start(pr, flpT, PRS_RETURN   );
			else if (tok_isKS(tk1, KS_USING    )) return parser_start(pr, flpT, PRS_USING    );
			else if (tok_isKS(tk1, KS_VAR      )) return parser_start(pr, flpT, PRS_VAR      );
			else if (tk1->type == TOK_IDENT){
				st->flpS = flpT;
				return parser_lookup(pr, flpT, PRS_IDENTS);
			}
			else if (tok_isPre(tk1) || tok_isTerm(tk1)){
				pr->level++;
				st->state = PRS_EVAL;
				st->flpS = flpT;
				return parser_process(pr, stmts);
			}
			else if (tok_isMidStmt(tk1)){
				if (st->next == NULL)
					return "Invalid statement";
				parser_pop(pr);
				return parser_process(pr, stmts);
			}
			return "Invalid statement";

		case PRS_STATEMENT_END:
			if (tk1->type != TOK_NEWLINE)
				return "Missing newline or semicolon";
			st->state = PRS_STATEMENT;
			return NULL;

		case PRS_LOOKUP:
			if (!tok_isKS(tk1, KS_PERIOD)){
				st->next->names = st->names;
				st->names = NULL;
				parser_pop(pr);
				return parser_process(pr, stmts);
			}
			st->state = PRS_LOOKUP_IDENT;
			return NULL;

		case PRS_LOOKUP_IDENT:
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			list_ptr_push(st->names, tk1->u.ident);
			tk1->u.ident = NULL;
			st->state = PRS_LOOKUP;
			return NULL;

		case PRS_BODY:
			st->state = PRS_BODY_STATEMENT;
			parser_push(pr, PRS_STATEMENT);
			return parser_process(pr, stmts);

		case PRS_BODY_STATEMENT:
			if (tok_isMidStmt(tk1)){
				parser_pop(pr);
				return parser_process(pr, stmts);
			}
			parser_push(pr, PRS_STATEMENT);
			return NULL;

		case PRS_LVALUES:
			if (tk1->type == TOK_NEWLINE){
				st->next->lvalues = st->lvalues;
				st->lvalues = NULL;
				parser_pop(pr);
				return parser_process(pr, stmts);
			}
			st->state = PRS_LVALUES_TERM_DONE;
			parser_push(pr, PRS_LVALUES_TERM);
			pr->state->lvaluesMode = st->lvaluesMode;
			return parser_process(pr, stmts);

		case PRS_LVALUES_TERM:
			if (tk1->type == TOK_IDENT)
				return parser_lookup(pr, flpT, PRS_LVALUES_TERM_LOOKUP);
			if (st->lvaluesMode == LVM_ENUM)
				return "Expecting enumerator name";
			if (tok_isKS(tk1, KS_LBRACE)){
				st->state = PRS_LVALUES_TERM_LIST_DONE;
				st->flpE = flpT;
				parser_push(pr, PRS_LVALUES_TERM_LIST);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_PERIOD3)){
				if (st->lvaluesMode == LVM_DEF){
					st->state = PRS_LVALUES_DEF_TAIL;
					return NULL;
				}
				else if (st->lvaluesMode == LVM_LIST){
					st->state = PRS_LVALUES_TERM_LIST_TAIL;
					return NULL;
				}
			}
			return "Expecting variable";

		case PRS_LVALUES_TERM_LOOKUP:
			st->next->exprTerm = expr_names(flpL, st->names);
			st->names = NULL;
			parser_pop(pr);
			return parser_process(pr, stmts);

		case PRS_LVALUES_TERM_LIST:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			else if (tok_isKS(tk1, KS_RBRACE)){
				st->next->exprTerm = st->exprTerm;
				st->exprTerm = NULL;
				parser_pop(pr);
				return NULL;
			}
			st->state = PRS_LVALUES_TERM_LIST_TERM_DONE;
			parser_push(pr, PRS_LVALUES_TERM);
			pr->state->lvaluesMode = LVM_LIST;
			return parser_process(pr, stmts);

		case PRS_LVALUES_TERM_LIST_TERM_DONE:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (st->exprTerm2 == NULL){
				st->exprTerm2 = st->exprTerm;
				st->exprTerm = NULL;
			}
			else{
				st->exprTerm2 =
					expr_infix(st->exprTerm2->flp, KS_COMMA, st->exprTerm2, st->exprTerm);
				st->exprTerm = NULL;
			}
			if (tok_isKS(tk1, KS_RBRACE)){
				st->next->exprTerm = st->exprTerm2;
				st->exprTerm2 = NULL;
				parser_pop(pr);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_COMMA)){
				parser_push(pr, PRS_LVALUES_TERM);
				pr->state->lvaluesMode = LVM_LIST;
				return NULL;
			}
			return "Invalid list";

		case PRS_LVALUES_TERM_LIST_TAIL:
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			return parser_lookup(pr, flpT, PRS_LVALUES_TERM_LIST_TAIL_LOOKUP);

		case PRS_LVALUES_TERM_LIST_TAIL_LOOKUP:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			st->state = PRS_LVALUES_TERM_LIST_TAIL_DONE;
			if (tok_isKS(tk1, KS_COMMA))
				return NULL;
			return parser_process(pr, stmts);

		case PRS_LVALUES_TERM_LIST_TAIL_DONE:
			if (!tok_isKS(tk1, KS_RBRACE))
				return "Missing end of list";
			st->next->exprTerm = expr_prefix(flpL, KS_PERIOD3, expr_names(flpL, st->names));
			st->names = NULL;
			parser_pop(pr);
			return parser_process(pr, stmts);

		case PRS_LVALUES_TERM_LIST_DONE:
			st->next->exprTerm = expr_list(flpE, st->exprTerm);
			st->exprTerm = NULL;
			parser_pop(pr);
			return parser_process(pr, stmts);

		case PRS_LVALUES_TERM_DONE:
			if (tk1->type == TOK_NEWLINE){
				list_ptr_push(st->lvalues, expr_infix(flpT, KS_EQU, st->exprTerm, NULL));
				st->exprTerm = NULL;
				st->next->lvalues = st->lvalues;
				st->lvalues = NULL;
				parser_pop(pr);
				return parser_process(pr, stmts);
			}
			else if (tok_isKS(tk1, KS_EQU)){
				st->exprTerm2 = st->exprTerm;
				st->exprTerm = NULL;
				parser_expr(pr, PRS_LVALUES_TERM_EXPR);
				pr->state->exprAllowComma = false;
				return NULL;
			}
			else if (tok_isKS(tk1, KS_COMMA)){
				list_ptr_push(st->lvalues,
					expr_infix(st->exprTerm->flp, KS_EQU, st->exprTerm, NULL));
				st->exprTerm = NULL;
				st->state = PRS_LVALUES_MORE;
				return NULL;
			}
			return "Invalid declaration";

		case PRS_LVALUES_TERM_EXPR:
			list_ptr_push(st->lvalues,
				expr_infix(st->exprTerm2->flp, KS_EQU, st->exprTerm2, st->exprTerm));
			st->exprTerm2 = NULL;
			st->exprTerm = NULL;
			if (tk1->type == TOK_NEWLINE){
				st->next->lvalues = st->lvalues;
				st->lvalues = NULL;
				parser_pop(pr);
				return parser_process(pr, stmts);
			}
			else if (tok_isKS(tk1, KS_COMMA)){
				st->state = PRS_LVALUES_MORE;
				return NULL;
			}
			return "Invalid declaration";

		case PRS_LVALUES_MORE:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			st->state = PRS_LVALUES_TERM_DONE;
			parser_push(pr, PRS_LVALUES_TERM);
			pr->state->lvaluesMode = st->lvaluesMode;
			return parser_process(pr, stmts);

		case PRS_LVALUES_DEF_TAIL:
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			return parser_lookup(pr, flpT, PRS_LVALUES_DEF_TAIL_DONE);

		case PRS_LVALUES_DEF_TAIL_DONE:
			if (tk1->type != TOK_NEWLINE)
				return "Missing newline or semicolon";
			st->next->names = st->names;
			st->names = NULL;
			parser_pop(pr);
			st = pr->state;
			list_ptr_push(st->lvalues, expr_prefix(flpL, KS_PERIOD3, expr_names(flpL, st->names)));
			st->names = NULL;
			st->next->lvalues = st->lvalues;
			st->lvalues = NULL;
			parser_pop(pr);
			return parser_process(pr, stmts);

		case PRS_BREAK:
			list_ptr_push(stmts, ast_break(flpS));
			return parser_statement(pr, stmts, false);

		case PRS_CONTINUE:
			list_ptr_push(stmts, ast_continue(flpS));
			return parser_statement(pr, stmts, false);

		case PRS_DECLARE:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			return parser_lookup(pr, flpT, PRS_DECLARE_LOOKUP);

		case PRS_DECLARE_LOOKUP:
			if (tok_isKS(tk1, KS_LPAREN)){
				st->state = PRS_DECLARE_STR;
				return NULL;
			}
			list_ptr_push(stmts, ast_declare(flpS, decl_local(flpL, st->names)));
			st->names = NULL;
			if (tok_isKS(tk1, KS_COMMA)){
				st->state = PRS_DECLARE;
				return NULL;
			}
			return parser_statement(pr, stmts, false);

		case PRS_DECLARE_STR:
			if (tk1->type != TOK_STR)
				return "Expecting string constant";
			list_ptr_push(stmts, ast_declare(flpS, decl_native(flpL, st->names, tk1->u.str)));
			st->names = NULL;
			tk1->u.str = NULL;
			st->state = PRS_DECLARE_STR2;
			return NULL;

		case PRS_DECLARE_STR2:
			if (!tok_isKS(tk1, KS_RPAREN))
				return "Expecting string constant";
			st->state = PRS_DECLARE_STR3;
			return NULL;

		case PRS_DECLARE_STR3:
			if (tok_isKS(tk1, KS_COMMA)){
				st->state = PRS_DECLARE;
				return NULL;
			}
			return parser_statement(pr, stmts, false);

		case PRS_DEF:
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			return parser_lookup(pr, flpT, PRS_DEF_LOOKUP);

		case PRS_DEF_LOOKUP:
			parser_lvalues(pr, PRS_DEF_LVALUES, LVM_DEF);
			return parser_process(pr, stmts);

		case PRS_DEF_LVALUES:
			if (tk1->type != TOK_NEWLINE)
				return "Missing newline or semicolon";
			list_ptr_push(stmts, ast_def1(flpS, flpL, st->names, st->lvalues));
			st->names = NULL;
			st->lvalues = NULL;
			st->state = PRS_DEF_BODY;
			parser_push(pr, PRS_BODY);
			return NULL;

		case PRS_DEF_BODY:
			if (!tok_isKS(tk1, KS_END))
				return "Missing `end` of def block";
			list_ptr_push(stmts, ast_def2(flpT));
			return parser_statement(pr, stmts, true);

		case PRS_DO:
			list_ptr_push(stmts, ast_dowhile1(flpS));
			st->state = PRS_DO_BODY;
			parser_push(pr, PRS_BODY);
			return parser_process(pr, stmts);

		case PRS_DO_BODY:
			if (tok_isKS(tk1, KS_WHILE)){
				parser_expr(pr, PRS_DO_WHILE_EXPR);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_END)){
				list_ptr_push(stmts, ast_dowhile2(flpT, NULL));
				list_ptr_push(stmts, ast_dowhile3(flpT));
				return parser_statement(pr, stmts, true);
			}
			return "Missing `while` or `end` of do block";

		case PRS_DO_WHILE_EXPR:
			list_ptr_push(stmts, ast_dowhile2(flpS, st->exprTerm));
			st->exprTerm = NULL;
			if (tk1->type == TOK_NEWLINE){
				st->state = PRS_DO_WHILE_BODY;
				parser_push(pr, PRS_BODY);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_END)){
				list_ptr_push(stmts, ast_dowhile3(flpT));
				return parser_statement(pr, stmts, true);
			}
			return "Missing newline or semicolon";

		case PRS_DO_WHILE_BODY:
			if (!tok_isKS(tk1, KS_END))
				return "Missing `end` of do-while block";
			list_ptr_push(stmts, ast_dowhile3(flpT));
			return parser_statement(pr, stmts, true);

		case PRS_FOR:
			if (tk1->type == TOK_NEWLINE){
				list_ptr_push(stmts, ast_loop1(flpS));
				st->state = PRS_LOOP_BODY;
				parser_push(pr, PRS_BODY);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_COLON)){
				st->state = PRS_FOR_VARS_DONE;
				return NULL;
			}
			st->state = PRS_FOR_VARS;
			if (tok_isKS(tk1, KS_VAR)){
				st->forVar = true;
				return NULL;
			}
			return parser_process(pr, stmts);

		case PRS_LOOP_BODY:
			if (!tok_isKS(tk1, KS_END))
				return "Missing `end` of for block";
			list_ptr_push(stmts, ast_loop2(flpT));
			return parser_statement(pr, stmts, true);

		case PRS_FOR_VARS:
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			return parser_lookup(pr, flpT, PRS_FOR_VARS_LOOKUP);

		case PRS_FOR_VARS_LOOKUP:
			st->names2 = st->names;
			st->names = NULL;
			if (tok_isKS(tk1, KS_COMMA)){
				st->state = PRS_FOR_VARS2;
				return NULL;
			}
			else if (tok_isKS(tk1, KS_COLON)){
				st->state = PRS_FOR_VARS_DONE;
				return NULL;
			}
			return "Invalid for loop";

		case PRS_FOR_VARS2:
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			return parser_lookup(pr, flpT, PRS_FOR_VARS2_LOOKUP);

		case PRS_FOR_VARS2_LOOKUP:
			if (!tok_isKS(tk1, KS_COLON))
				return "Expecting `:`";
			st->state = PRS_FOR_VARS_DONE;
			return NULL;

		case PRS_FOR_VARS_DONE:
			if (tk1->type == TOK_NEWLINE)
				return "Expecting expression in for statement";
			parser_expr(pr, PRS_FOR_EXPR);
			return parser_process(pr, stmts);

		case PRS_FOR_EXPR:
			list_ptr_push(stmts, ast_for1(flpS, st->forVar, st->names2, st->names, st->exprTerm));
			st->names2 = NULL;
			st->names = NULL;
			st->exprTerm = NULL;
			if (tk1->type == TOK_NEWLINE){
				st->state = PRS_FOR_BODY;
				parser_push(pr, PRS_BODY);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_END)){
				list_ptr_push(stmts, ast_for2(flpT));
				return parser_statement(pr, stmts, true);
			}
			return "Missing newline or semicolon";

		case PRS_FOR_BODY:
			if (!tok_isKS(tk1, KS_END))
				return "Missing `end` of for block";
			list_ptr_push(stmts, ast_for2(flpT));
			return parser_statement(pr, stmts, true);

		case PRS_GOTO:
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			list_ptr_push(stmts, ast_goto(flpS, tk1->u.ident));
			tk1->u.ident = NULL;
			return parser_statement(pr, stmts, true);

		case PRS_IF:
			list_ptr_push(stmts, ast_if1(flpS));
			st->state = PRS_IF2;
			return parser_process(pr, stmts);

		case PRS_IF2:
			if (tk1->type == TOK_NEWLINE)
				return "Missing conditional expression";
			parser_expr(pr, PRS_IF_EXPR);
			return parser_process(pr, stmts);

		case PRS_IF_EXPR:
			list_ptr_push(stmts, ast_if2(flpS, st->exprTerm));
			st->exprTerm = NULL;
			if (tk1->type == TOK_NEWLINE){
				st->state = PRS_IF_BODY;
				parser_push(pr, PRS_BODY);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_ELSEIF)){
				st->state = PRS_IF2;
				return NULL;
			}
			list_ptr_push(stmts, ast_if3(flpS));
			if (tok_isKS(tk1, KS_ELSE)){
				st->state = PRS_ELSE_BODY;
				parser_push(pr, PRS_BODY);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_END)){
				list_ptr_push(stmts, ast_if4(flpT));
				return parser_statement(pr, stmts, true);
			}
			return "Missing newline or semicolon";

		case PRS_IF_BODY:
			if (tok_isKS(tk1, KS_ELSEIF)){
				st->state = PRS_IF2;
				return NULL;
			}
			list_ptr_push(stmts, ast_if3(flpS));
			if (tok_isKS(tk1, KS_ELSE)){
				st->state = PRS_ELSE_BODY;
				parser_push(pr, PRS_BODY);
				return NULL;
			}
			else if (tok_isKS(tk1, KS_END)){
				list_ptr_push(stmts, ast_if4(flpT));
				return parser_statement(pr, stmts, true);
			}
			return "Missing `elseif`, `else`, or `end` of if block";

		case PRS_ELSE_BODY:
			if (!tok_isKS(tk1, KS_END))
				return "Missing `end` of if block";
			list_ptr_push(stmts, ast_if4(flpT));
			return parser_statement(pr, stmts, true);

		case PRS_ENUM:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			parser_lvalues(pr, PRS_ENUM_LVALUES, LVM_ENUM);
			return parser_process(pr, stmts);

		case PRS_ENUM_LVALUES:
			if (st->lvalues->size <= 0)
				return "Invalid enumerator declaration";
			list_ptr_push(stmts, ast_enum(flpS, st->lvalues));
			st->lvalues = NULL;
			return parser_statement(pr, stmts, false);

		case PRS_INCLUDE:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			else if (tk1->type == TOK_IDENT)
				return parser_lookup(pr, flpT, PRS_INCLUDE_LOOKUP);
			else if (tok_isKS(tk1, KS_LPAREN)){
				st->state = PRS_INCLUDE_STR;
				return NULL;
			}
			else if (tok_isKS(tk1, KS_PLUS)){
				st->names = INCL_UNIQUE;
				st->state = PRS_INCLUDE_LOOKUP;
				return NULL;
			}
			return "Expecting file as constant string literal";

		case PRS_INCLUDE_LOOKUP:
			if (!tok_isKS(tk1, KS_LPAREN))
				return "Expecting file as constant string literal";
			st->state = PRS_INCLUDE_STR;
			return NULL;

		case PRS_INCLUDE_STR:
			if (tk1->type != TOK_STR)
				return "Expecting file as constant string literal";
			st->str = tk1->u.str;
			tk1->u.str = NULL;
			st->state = PRS_INCLUDE_STR2;
			return NULL;

		case PRS_INCLUDE_STR2:
			if (!tok_isKS(tk1, KS_RPAREN))
				return "Expecting file as constant string literal";
			st->state = PRS_INCLUDE_STR3;
			return NULL;

		case PRS_INCLUDE_STR3:
			if (st->incls == NULL)
				st->incls = list_ptr_new(incl_free);
			list_byte_null(st->str);
			list_ptr_push(st->incls, incl_new(st->names, st->str));
			st->names = NULL;
			st->str = NULL;
			if (tok_isKS(tk1, KS_COMMA)){
				st->state = PRS_INCLUDE;
				return NULL;
			}
			list_ptr_push(stmts, ast_include(flpS, st->incls));
			st->incls = NULL;
			return parser_statement(pr, stmts, false);

		case PRS_NAMESPACE:
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			return parser_lookup(pr, flpT, PRS_NAMESPACE_LOOKUP);

		case PRS_NAMESPACE_LOOKUP:
			if (tk1->type != TOK_NEWLINE)
				return "Missing newline or semicolon";
			list_ptr_push(stmts, ast_namespace1(flpS, st->names));
			st->names = NULL;
			st->state = PRS_NAMESPACE_BODY;
			parser_push(pr, PRS_BODY);
			return NULL;

		case PRS_NAMESPACE_BODY:
			if (!tok_isKS(tk1, KS_END))
				return "Missing `end` of namespace block";
			list_ptr_push(stmts, ast_namespace2(flpT));
			return parser_statement(pr, stmts, true);

		case PRS_RETURN:
			if (tk1->type == TOK_NEWLINE){
				list_ptr_push(stmts, ast_return(flpS, expr_nil(flpS)));
				return parser_statement(pr, stmts, false);
			}
			parser_expr(pr, PRS_RETURN_DONE);
			return parser_process(pr, stmts);

		case PRS_RETURN_DONE:
			list_ptr_push(stmts, ast_return(flpS, st->exprTerm));
			st->exprTerm = NULL;
			return parser_statement(pr, stmts, false);

		case PRS_USING:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (tk1->type != TOK_IDENT)
				return "Expecting identifier";
			return parser_lookup(pr, flpT, PRS_USING_LOOKUP);

		case PRS_USING_LOOKUP:
			list_ptr_push(stmts, ast_using(flpS, st->names));
			st->names = NULL;
			if (tok_isKS(tk1, KS_COMMA)){
				st->state = PRS_USING;
				return NULL;
			}
			return parser_statement(pr, stmts, false);

		case PRS_VAR:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			parser_lvalues(pr, PRS_VAR_LVALUES, LVM_VAR);
			return parser_process(pr, stmts);

		case PRS_VAR_LVALUES:
			if (st->lvalues->size <= 0)
				return "Invalid variable declaration";
			list_ptr_push(stmts, ast_var(flpS, st->lvalues));
			st->lvalues = NULL;
			return parser_statement(pr, stmts, false);

		case PRS_IDENTS:
			if (st->names->size == 1 && tok_isKS(tk1, KS_COLON)){
				list_ptr_push(stmts, ast_label(st->flpS, list_ptr_pop(st->names)));
				list_ptr_free(st->names);
				st->names = NULL;
				st->state = PRS_STATEMENT;
				return NULL;
			}
			pr->level++;
			st->state = PRS_EVAL_EXPR;
			parser_push(pr, PRS_EXPR_POST);
			pr->state->exprTerm = expr_names(flpL, st->names);
			st->names = NULL;
			return parser_process(pr, stmts);

		case PRS_EVAL:
			parser_expr(pr, PRS_EVAL_EXPR);
			return parser_process(pr, stmts);

		case PRS_EVAL_EXPR:
			list_ptr_push(stmts, ast_eval(flpS, st->exprTerm));
			st->exprTerm = NULL;
			return parser_statement(pr, stmts, false);

		case PRS_EXPR:
			st->flpE = flpT;
			st->state = PRS_EXPR_PRE;
			// fall through
		case PRS_EXPR_PRE:
			if (tok_isPre(tk1)){
				st->exprPreStack = ets_new(tk1, st->exprPreStack);
				pr->tk1 = NULL;
				return NULL;
			}
			st->state = PRS_EXPR_TERM;
			return parser_process(pr, stmts);

		case PRS_EXPR_TERM:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			else if (tok_isKS(tk1, KS_NIL)){
				st->state = PRS_EXPR_POST;
				st->exprTerm = expr_nil(flpT);
				return NULL;
			}
			else if (tk1->type == TOK_NUM){
				st->state = PRS_EXPR_POST;
				st->exprTerm = expr_num(flpT, tk1->u.num);
				return NULL;
			}
			else if (tk1->type == TOK_STR){
				st->state = PRS_EXPR_POST;
				st->exprTerm = expr_str(flpT, tk1->u.str);
				tk1->u.str = NULL;
				return NULL;
			}
			else if (tk1->type == TOK_IDENT)
				return parser_lookup(pr, flpT, PRS_EXPR_TERM_LOOKUP);
			else if (tok_isKS(tk1, KS_LBRACE)){
				st->state = PRS_EXPR_TERM_ISEMPTYLIST;
				return NULL;
			}
			else if (tok_isKS(tk1, KS_LPAREN)){
				parser_expr(pr, PRS_EXPR_TERM_CLOSEPAREN);
				pr->state->exprAllowTrailComma = true;
				return NULL;
			}
			return "Invalid expression";

		case PRS_EXPR_TERM_ISEMPTYLIST:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			else if (tok_isKS(tk1, KS_RBRACE)){
				st->state = PRS_EXPR_POST;
				st->exprTerm = expr_list(flpE, NULL);
				return NULL;
			}
			parser_expr(pr, PRS_EXPR_TERM_CLOSEBRACE);
			pr->state->exprAllowTrailComma = true;
			return parser_process(pr, stmts);

		case PRS_EXPR_TERM_CLOSEBRACE:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (!tok_isKS(tk1, KS_RBRACE))
				return "Expecting close brace";
			st->exprTerm = expr_list(flpE, st->exprTerm);
			st->state = PRS_EXPR_POST;
			return NULL;

		case PRS_EXPR_TERM_CLOSEPAREN:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (!tok_isKS(tk1, KS_RPAREN))
				return "Expecting close parenthesis";
			st->exprTerm = expr_paren(st->exprTerm->flp, st->exprTerm);
			st->state = PRS_EXPR_POST;
			return NULL;

		case PRS_EXPR_TERM_LOOKUP:
			st->exprTerm = expr_names(flpL, st->names);
			st->names = NULL;
			st->state = PRS_EXPR_POST;
			return parser_process(pr, stmts);

		case PRS_EXPR_POST:
			if (tk1->type == TOK_NEWLINE ||
				tok_isKS(tk1, KS_END) || tok_isKS(tk1, KS_ELSE) || tok_isKS(tk1, KS_ELSEIF)){
				st->state = PRS_EXPR_FINISH;
				return parser_process(pr, stmts);
			}
			else if (tok_isKS(tk1, KS_LBRACKET)){
				st->state = PRS_EXPR_INDEX_CHECK;
				return NULL;
			}
			else if (tok_isMid(tk1, st->exprAllowComma, st->exprAllowPipe)){
				if (st->exprAllowTrailComma && tok_isKS(tk1, KS_COMMA)){
					st->state = PRS_EXPR_COMMA;
					return NULL;
				}
				st->state = PRS_EXPR_MID;
				return parser_process(pr, stmts);
			}
			else if (tok_isKS(tk1, KS_RBRACE) || tok_isKS(tk1, KS_RBRACKET) ||
				tok_isKS(tk1, KS_RPAREN) || tok_isKS(tk1, KS_COLON) || tok_isKS(tk1, KS_COMMA) ||
				tok_isKS(tk1, KS_PIPE)){
				st->state = PRS_EXPR_FINISH;
				return parser_process(pr, stmts);
			}
			// otherwise, this should be a call
			st->exprTerm2 = st->exprTerm;
			st->exprTerm = NULL;
			parser_expr(pr, PRS_EXPR_POST_CALL);
			pr->state->exprAllowPipe = false;
			return parser_process(pr, stmts);

		case PRS_EXPR_POST_CALL:
			st->exprTerm = expr_call(st->exprTerm2->flp, st->exprTerm2, st->exprTerm);
			st->exprTerm2 = NULL;
			st->state = PRS_EXPR_POST;
			return parser_process(pr, stmts);

		case PRS_EXPR_INDEX_CHECK:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (tok_isKS(tk1, KS_COLON)){
				st->state = PRS_EXPR_INDEX_COLON_CHECK;
				return NULL;
			}
			st->exprTerm2 = st->exprTerm;
			st->exprTerm = NULL;
			parser_expr(pr, PRS_EXPR_INDEX_EXPR_CHECK);
			return parser_process(pr, stmts);

		case PRS_EXPR_INDEX_COLON_CHECK:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (tok_isKS(tk1, KS_RBRACKET)){
				st->exprTerm = expr_slice(flpT, st->exprTerm, NULL, NULL);
				st->state = PRS_EXPR_POST;
				return NULL;
			}
			st->exprTerm2 = st->exprTerm;
			st->exprTerm = NULL;
			parser_expr(pr, PRS_EXPR_INDEX_COLON_EXPR);
			return parser_process(pr, stmts);

		case PRS_EXPR_INDEX_COLON_EXPR:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (!tok_isKS(tk1, KS_RBRACKET))
				return "Missing close bracket";
			st->exprTerm = expr_slice(st->exprTerm->flp, st->exprTerm2, NULL, st->exprTerm);
			st->exprTerm2 = NULL;
			st->state = PRS_EXPR_POST;
			return NULL;

		case PRS_EXPR_INDEX_EXPR_CHECK:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (tok_isKS(tk1, KS_COLON)){
				st->state = PRS_EXPR_INDEX_EXPR_COLON_CHECK;
				return NULL;
			}
			if (!tok_isKS(tk1, KS_RBRACKET))
				return "Missing close bracket";
			st->exprTerm = expr_index(st->exprTerm->flp, st->exprTerm2, st->exprTerm);
			st->exprTerm2 = NULL;
			st->state = PRS_EXPR_POST;
			return NULL;

		case PRS_EXPR_INDEX_EXPR_COLON_CHECK:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (tok_isKS(tk1, KS_RBRACKET)){
				st->exprTerm = expr_slice(st->exprTerm->flp, st->exprTerm2, st->exprTerm, NULL);
				st->exprTerm2 = NULL;
				st->state = PRS_EXPR_POST;
				return NULL;
			}
			st->exprTerm3 = st->exprTerm;
			st->exprTerm = NULL;
			parser_expr(pr, PRS_EXPR_INDEX_EXPR_COLON_EXPR);
			return parser_process(pr, stmts);

		case PRS_EXPR_INDEX_EXPR_COLON_EXPR:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft)
				return NULL;
			if (!tok_isKS(tk1, KS_RBRACKET))
				return "Missing close bracket";
			st->exprTerm =
				expr_slice(st->exprTerm3->flp, st->exprTerm2, st->exprTerm3, st->exprTerm);
			st->exprTerm2 = NULL;
			st->exprTerm3 = NULL;
			st->state = PRS_EXPR_POST;
			return NULL;

		case PRS_EXPR_COMMA:
			if (tk1->type == TOK_NEWLINE && !tk1->u.soft){
				parser_rev(pr); // keep the comma in tk1
				tok_free(pr->tkR); // free the newline
				pr->tkR = NULL;
				return NULL;
			}
			if (!tok_isKS(tk1, KS_RPAREN) && !tok_isKS(tk1, KS_RBRACE)){
				st->state = PRS_EXPR_MID;
				parser_rev(pr);
				parser_process(pr, stmts);
				parser_fwd(pr, pr->tkR);
				return parser_process(pr, stmts);
			}
			// found a trailing comma
			st->state = PRS_EXPR_FINISH;
			return parser_process(pr, stmts);

		case PRS_EXPR_MID:
			if (!tok_isMid(tk1, st->exprAllowComma, st->exprAllowPipe)){
				st->state = PRS_EXPR_FINISH;
				return parser_process(pr, stmts);
			}
			while (true){
				// fight between the Pre and the Mid
				while (st->exprPreStack != NULL && tok_isPreBeforeMid(st->exprPreStack->tk, tk1)){
					// apply the Pre
					tok ptk = st->exprPreStack->tk;
					st->exprTerm = expr_prefix(ptk->flp, ptk->u.k, st->exprTerm);
					ets next = st->exprPreStack->next;
					ets_free(st->exprPreStack);
					st->exprPreStack = next;
				}

				// if we've exhaused the exprPreStack, then check against the exprMidStack
				if (st->exprPreStack == NULL && st->exprMidStack != NULL &&
					tok_isMidBeforeMid(st->exprMidStack->tk, tk1)){
					// apply the previous Mid
					tok mtk = st->exprMidStack->tk;
					pri_st pri = parser_infix(mtk->flp, mtk->u.k, st->exprStack->ex, st->exprTerm);
					if (!pri.ok)
						return pri.u.msg;
					st->exprTerm = pri.u.ex;
					st->exprStack->ex = NULL;
					exs next = st->exprStack->next;
					exs_free(st->exprStack);
					st->exprStack = next;
					st->exprPreStack = st->exprPreStackStack->e;
					st->exprPreStackStack->e = NULL;
					eps next2 = st->exprPreStackStack->next;
					eps_free(st->exprPreStackStack);
					st->exprPreStackStack = next2;
					ets next3 = st->exprMidStack->next;
					ets_free(st->exprMidStack);
					st->exprMidStack = next3;
				}
				else // otherwise, the current Mid wins
					break;
			}
			// finally, we're safe to apply the Mid...
			// except instead of applying it, we need to schedule to apply it, in case another
			// operator takes precedence over this one
			st->exprPreStackStack = eps_new(st->exprPreStack, st->exprPreStackStack);
			st->exprPreStack = NULL;
			st->exprStack = exs_new(st->exprTerm, st->exprStack);
			st->exprTerm = NULL;
			st->exprMidStack = ets_new(tk1, st->exprMidStack);
			pr->tk1 = NULL;
			st->state = PRS_EXPR_PRE;
			return NULL;

		case PRS_EXPR_FINISH:
			while (true){
				// apply any outstanding Pre's
				while (st->exprPreStack != NULL){
					tok ptk = st->exprPreStack->tk;
					st->exprTerm = expr_prefix(ptk->flp, ptk->u.k, st->exprTerm);
					ets next = st->exprPreStack->next;
					ets_free(st->exprPreStack);
					st->exprPreStack = next;
				}

				// grab left side's Pre's
				if (st->exprPreStackStack != NULL){
					st->exprPreStack = st->exprPreStackStack->e;
					st->exprPreStackStack->e = NULL;
					eps next2 = st->exprPreStackStack->next;
					eps_free(st->exprPreStackStack);
					st->exprPreStackStack = next2;
				}

				// fight between the left Pre and the Mid
				while (st->exprPreStack != NULL &&
					(st->exprMidStack == NULL ||
						tok_isPreBeforeMid(st->exprPreStack->tk, st->exprMidStack->tk))){
					// apply the Pre to the left side
					tok ptk = st->exprPreStack->tk;
					st->exprStack->ex = expr_prefix(ptk->flp, ptk->u.k, st->exprStack->ex);
					ets next = st->exprPreStack->next;
					ets_free(st->exprPreStack);
					st->exprPreStack = next;
				}

				if (st->exprMidStack == NULL)
					break;

				// apply the Mid
				tok mtk = st->exprMidStack->tk;
				pri_st pri = parser_infix(mtk->flp, mtk->u.k, st->exprStack->ex, st->exprTerm);
				if (!pri.ok)
					return pri.u.msg;
				st->exprTerm = pri.u.ex;
				st->exprStack->ex = NULL;
				exs next = st->exprStack->next;
				exs_free(st->exprStack);
				st->exprStack = next;
				ets next3 = st->exprMidStack->next;
				ets_free(st->exprMidStack);
				st->exprMidStack = next3;
			}
			// everything has been applied, and exprTerm has been set!
			st->next->exprTerm = st->exprTerm;
			st->exprTerm = NULL;
			parser_pop(pr);
			return parser_process(pr, stmts);
	}
}

static inline const char *parser_add(parser pr, tok tk, list_ptr stmts){
	parser_fwd(pr, tk);
	return parser_process(pr, stmts);
}

static inline const char *parser_close(parser pr){
	if (pr->state->next != NULL)
		return "Invalid end of file";
	return NULL;
}

//
// labels
//

typedef struct {
	list_byte name;
	int pos;
	list_int rewrites;
} label_st, *label;

static inline void label_free(label lbl){
	if (lbl->name)
		list_byte_free(lbl->name);
	list_int_free(lbl->rewrites);
	mem_free(lbl);
}

static inline label label_new(list_byte name){
	label lbl = mem_alloc(sizeof(label_st));
	lbl->name = name;
	lbl->pos = -1;
	lbl->rewrites = list_int_new();
	return lbl;
}

#ifdef SINK_DEBUG
// hard-coded labels are prefixed with a character that can't be in a script label
#	define label_newstr(s) label_new(list_byte_newstr("^" s))
#else
#	define label_newstr(s) label_new(NULL)
#endif

static void label_refresh(label lbl, list_byte ops, int start){
	for (int i = start; i < lbl->rewrites->size; i++){
		int index = lbl->rewrites->vals[i];
		ops->bytes[index + 0] = lbl->pos % 256;
		ops->bytes[index + 1] = (lbl->pos >> 8) % 256;
		ops->bytes[index + 2] = (lbl->pos >> 16) % 256;
		ops->bytes[index + 3] = (lbl->pos >> 24) % 256;
	}
}

static inline void label_jump(label lbl, list_byte ops){
	op_jump(ops, 0xFFFFFFFF, lbl->name);
	list_int_push(lbl->rewrites, ops->size - 4);
	if (lbl->pos >= 0)
		label_refresh(lbl, ops, lbl->rewrites->size - 1);
}

static inline void label_jumptrue(label lbl, list_byte ops, varloc_st src){
	op_jumptrue(ops, src, 0xFFFFFFFF, lbl->name);
	list_int_push(lbl->rewrites, ops->size - 4);
	if (lbl->pos >= 0)
		label_refresh(lbl, ops, lbl->rewrites->size - 1);
}

static inline void label_jumpfalse(label lbl, list_byte ops, varloc_st src){
	op_jumpfalse(ops, src, 0xFFFFFFFF, lbl->name);
	list_int_push(lbl->rewrites, ops->size - 4);
	if (lbl->pos >= 0)
		label_refresh(lbl, ops, lbl->rewrites->size - 1);
}

static inline void label_call(label lbl, list_byte ops, varloc_st ret, int argcount){
	op_call(ops, ret, 0xFFFFFFFF, argcount, lbl->name);
	list_int_push(lbl->rewrites, ops->size - 5);
	if (lbl->pos >= 0)
		label_refresh(lbl, ops, lbl->rewrites->size - 1);
}

static inline void label_returntail(label lbl, list_byte ops, int argcount){
	op_returntail(ops, 0xFFFFFFFF, argcount, lbl->name);
	list_int_push(lbl->rewrites, ops->size - 5);
	if (lbl->pos >= 0)
		label_refresh(lbl, ops, lbl->rewrites->size - 1);
}

static inline void label_declare(label lbl, list_byte ops){
	debugf("%.*s:", lbl->name->size, lbl->name->bytes);
	lbl->pos = ops->size;
	label_refresh(lbl, ops, 0);
}

//
// symbol table
//

typedef enum {
	FVR_VAR,
	FVR_TEMP_INUSE,
	FVR_TEMP_AVAIL
} frame_enum;

typedef struct frame_struct frame_st, *frame;
struct frame_struct {
	list_int vars;
	list_ptr lbls;
	frame parent;
	int level;
};

static inline void frame_free(frame fr){
	list_int_free(fr->vars);
	list_ptr_free(fr->lbls);
	mem_free(fr);
}

#ifdef SINK_DEBUG
static void frame_print(frame fr){
	debug("FRAME:");
	for (int i = 0; i < fr->vars->size; i++){
		debugf("  %d. %s", i, fr->vars->vals[i] == FVR_VAR ? "VAR" :
			(fr->vars->vals[i] == FVR_TEMP_INUSE ? "TMP (Used)" : "TMP (Avlb)"));
	}
	if (fr->lbls->size > 0){
		debug("  -> LABELS:");
		for (int i = 0; i < fr->lbls->size; i++){
			list_byte b = ((label)fr->lbls->ptrs[i])->name;
			debugf("  %.*s", b->size, b->bytes);
		}
	}
}
#endif

static inline frame frame_new(frame parent){
	frame fr = mem_alloc(sizeof(frame_st));
	fr->vars = list_int_new();
	fr->lbls = list_ptr_new(label_free);
	fr->parent = parent;
	fr->level = parent ? fr->parent->level + 1 : 0;
	return fr;
}

typedef struct namespace_struct namespace_st, *namespace;
static inline void namespace_free(namespace ns);

typedef enum {
	NSN_VAR,
	NSN_ENUM,
	NSN_CMD_LOCAL,
	NSN_CMD_NATIVE,
	NSN_CMD_OPCODE,
	NSN_NAMESPACE
} nsname_enumt;

typedef struct {
	list_byte name;
	nsname_enumt type;
	union {
		struct {
			frame fr; // not freed by nsname_free
			int index;
		} var;
		double val;
		struct {
			frame fr; // not freed by nsname_free
			label lbl; // not feed by nsname_free
		} cmdLocal;
		uint64_t hash;
		struct {
			op_enum opcode;
			int params;
		} cmdOpcode;
		namespace ns;
	} u;
} nsname_st, *nsname;

static void nsname_free(nsname nsn){
	list_byte_free(nsn->name);
	switch (nsn->type){
		case NSN_VAR:
		case NSN_ENUM:
		case NSN_CMD_LOCAL:
		case NSN_CMD_NATIVE:
		case NSN_CMD_OPCODE:
			break;
		case NSN_NAMESPACE:
			if (nsn->u.ns)
				namespace_free(nsn->u.ns);
			break;
	}
	mem_free(nsn);
}

#ifdef SINK_DEBUG
static void nsname_print(nsname nsn){
	switch (nsn->type){
		case NSN_VAR:
			debugf("%.*s NSN_VAR %d", nsn->name->size, nsn->name->bytes, nsn->u.var.index);
			break;
		case NSN_ENUM:
			debugf("%.*s NSN_ENUM %g", nsn->name->size, nsn->name->bytes, nsn->u.val);
			break;
		case NSN_CMD_LOCAL:
			debugf("%.*s NSN_CMD_LOCAL", nsn->name->size, nsn->name->bytes);
			break;
		case NSN_CMD_NATIVE:
			debugf("%.*s NSN_CMD_NATIVE", nsn->name->size, nsn->name->bytes);
			break;
		case NSN_CMD_OPCODE:
			debugf("%.*s NSN_CMD_OPCODE 0x%02X", nsn->name->size, nsn->name->bytes,
				nsn->u.cmdOpcode.opcode);
			break;
		case NSN_NAMESPACE:
			debugf("%.*s NSN_NAMESPACE", nsn->name->size, nsn->name->bytes);
			break;
	}
}
#endif

static inline nsname nsname_var(list_byte name, frame fr, int index){
	nsname nsn = mem_alloc(sizeof(nsname_st));
	nsn->name = list_byte_newcopy(name);
	nsn->type = NSN_VAR;
	nsn->u.var.fr = fr;
	nsn->u.var.index = index;
	return nsn;
}

static inline nsname nsname_enum(list_byte name, double val, bool own){
	nsname nsn = mem_alloc(sizeof(nsname_st));
	nsn->name = own ? name : list_byte_newcopy(name);
	nsn->type = NSN_ENUM;
	nsn->u.val = val;
	return nsn;
}

static inline nsname nsname_cmdLocal(list_byte name, frame fr, label lbl){
	nsname nsn = mem_alloc(sizeof(nsname_st));
	nsn->name = list_byte_newcopy(name);
	nsn->type = NSN_CMD_LOCAL;
	nsn->u.cmdLocal.fr = fr;
	nsn->u.cmdLocal.lbl = lbl;
	return nsn;
}

static inline nsname nsname_cmdNative(list_byte name, uint64_t hash){
	nsname nsn = mem_alloc(sizeof(nsname_st));
	nsn->name = list_byte_newcopy(name);
	nsn->type = NSN_CMD_NATIVE;
	nsn->u.hash = hash;
	return nsn;
}

static inline nsname nsname_cmdOpcode(list_byte name, op_enum opcode, int params){
	nsname nsn = mem_alloc(sizeof(nsname_st));
	nsn->name = name; // don't copy because the only caller gives `name` to nsn
	nsn->type = NSN_CMD_OPCODE;
	nsn->u.cmdOpcode.opcode = opcode;
	nsn->u.cmdOpcode.params = params;
	return nsn;
}

static inline nsname nsname_namespacegive(list_byte name, namespace ns){
	nsname nsn = mem_alloc(sizeof(nsname_st));
	nsn->name = name;
	nsn->type = NSN_NAMESPACE;
	nsn->u.ns = ns;
	return nsn;
}

static inline nsname nsname_namespace(list_byte name, namespace ns){
	return nsname_namespacegive(list_byte_newcopy(name), ns);
}

struct namespace_struct {
	frame fr; // not freed by namespace_free
	list_ptr usings; // namespace entries not feed by namespace_free
	list_ptr names;
};

static inline void namespace_free(namespace ns){
	list_ptr_free(ns->usings);
	list_ptr_free(ns->names);
	mem_free(ns);
}

#ifdef SINK_DEBUG
static void namespace_print(namespace ns){
	debug("NAMESPACE:");
	for (int i = 0; i < ns->names->size; i++)
		nsname_print(ns->names->ptrs[i]);
}
#endif

static inline namespace namespace_new(frame fr){
	namespace ns = mem_alloc(sizeof(namespace_st));
	ns->fr = fr;
	ns->usings = list_ptr_new(NULL);
	ns->names = list_ptr_new(nsname_free);
	return ns;
}

typedef struct {
	bool found;
	nsname nsn;
} nl_st;

static inline nl_st nl_found(nsname nsn){
	return (nl_st){ .found = true, .nsn = nsn };
}

static inline nl_st nl_notfound(){
	return (nl_st){ .found = false };
}

static nl_st namespace_lookup(namespace ns, list_ptr names, int start, list_ptr tried);

static nl_st namespace_lookupLevel(namespace ns, list_ptr names, int start, list_ptr tried){
	for (int nsni = 0; nsni < ns->names->size; nsni++){
		nsname nsn = ns->names->ptrs[nsni];
		if (list_byte_equ(nsn->name, names->ptrs[start])){
			if (start == names->size - 1) // if we're at the end of names, then report the find
				return nl_found(nsn);
			// otherwise, we need to traverse
			if (nsn->type == NSN_NAMESPACE)
				return namespace_lookup(nsn->u.ns, names, start + 1, tried);
			return nl_notfound();
		}
	}
	return nl_notfound();
}

static void namespace_getSiblings(namespace ns, list_ptr res, list_ptr tried){
	if (list_ptr_has(res, ns))
		return;
	list_ptr_push(res, ns);
	for (int i = 0; i < ns->usings->size; i++){
		namespace uns = ns->usings->ptrs[i];
		if (list_ptr_has(tried, uns))
			continue;
		namespace_getSiblings(uns, res, tried);
	}
}

static nl_st namespace_lookup(namespace ns, list_ptr names, int start, list_ptr tried){
	if (list_ptr_has(tried, ns))
		return nl_notfound();
	list_ptr_push(tried, ns);

	list_ptr allns = list_ptr_new(NULL);
	namespace_getSiblings(ns, allns, tried);
	for (int i = 0; i < allns->size; i++){
		namespace hns = allns->ptrs[i];
		nl_st n = namespace_lookupLevel(hns, names, start, tried);
		if (n.found){
			list_ptr_free(allns);
			return n;
		}
	}
	list_ptr_free(allns);
	return nl_notfound();
}

static inline nl_st namespace_lookupImmediate(namespace ns, list_ptr names){
	// should perform the most ideal lookup... if it fails, then there is room to add a symbol
	for (int ni = 0; ni < names->size; ni++){
		list_byte name = names->ptrs[ni];
		bool found = false;
		for (int nsni = 0; nsni < ns->names->size; nsni++){
			nsname nsn = ns->names->ptrs[nsni];
			if (list_byte_equ(nsn->name, name)){
				if (ni == names->size - 1)
					return nl_found(nsn);
				if (nsn->type != NSN_NAMESPACE)
					return nl_notfound();
				ns = nsn->u.ns;
				found = true;
				break;
			}
		}
		if (!found)
			return nl_notfound();
	}
	return nl_notfound();
}

typedef struct scope_struct scope_st, *scope;
struct scope_struct {
	namespace ns;
	list_ptr nsStack;
	list_ptr declares;
	label lblBreak; // not freed by scope_free
	label lblContinue; // not freed by scope_free
	scope parent;
};

static inline void scope_free(scope sc){
	// only free the first namespace...
	// this is because the first namespace will have all the child namespaces under it inside
	// the ns->names field, which will be freed via nsname_free
	namespace_free(sc->nsStack->ptrs[0]);
	list_ptr_free(sc->nsStack);
	list_ptr_free(sc->declares);
	mem_free(sc);
}

#ifdef SINK_DEBUG
static void scope_print(scope sc){
	for (int i = 0; i < sc->nsStack->size; i++)
		namespace_print(sc->nsStack->ptrs[i]);
}
#endif

static inline scope scope_new(frame fr, label lblBreak, label lblContinue, scope parent){
	scope sc = mem_alloc(sizeof(scope_st));
	sc->ns = namespace_new(fr);
	sc->nsStack = list_ptr_new(NULL);
	sc->declares = list_ptr_new(mem_free_func);
	list_ptr_push(sc->nsStack, sc->ns);
	sc->lblBreak = lblBreak;
	sc->lblContinue = lblContinue;
	sc->parent = parent;
	return sc;
}

#define SCD_HINT_SIZE 96
typedef struct {
	label lbl;
	char hint[SCD_HINT_SIZE];
	filepos_st flp;
} scopedecl_st, *scopedecl;

static inline void scope_addDeclare(scope sc, filepos_st flp, list_ptr names, label lbl){
	scopedecl scd = mem_alloc(sizeof(scopedecl_st));
	scd->flp = flp;
	scd->lbl = lbl;
	int sz = 0;
	for (int i = 0; i < names->size; i++){
		list_byte lb = names->ptrs[i];
		if (sz + 5 + lb->size >= SCD_HINT_SIZE){
			scd->hint[sz++] = '.';
			scd->hint[sz++] = '.';
			scd->hint[sz++] = '.';
			break;
		}
		else{
			if (i > 0)
				scd->hint[sz++] = '.';
			memcpy(&scd->hint[sz], lb->bytes, sizeof(uint8_t) * lb->size);
			sz += lb->size;
		}
	}
	scd->hint[sz] = 0;
	list_ptr_push(sc->declares, scd);
}

static inline void scope_removeDeclare(scope sc, label lbl){
	for (int i = 0; i < sc->declares->size; i++){
		scopedecl scd = sc->declares->ptrs[i];
		if (scd->lbl == lbl){
			mem_free(scd);
			list_ptr_remove(sc->declares, i);
			return;
		}
	}
	assert(false);
}

typedef struct {
	frame fr;
	scope sc;
	bool repl;
} symtbl_st, *symtbl;

static inline void symtbl_free(symtbl sym){
	frame here = sym->fr;
	while (here){
		frame del = here;
		here = here->parent;
		frame_free(del);
	}
	scope here2 = sym->sc;
	while (here2){
		scope del = here2;
		here2 = here2->parent;
		scope_free(del);
	}
	mem_free(sym);
}

static void symtbl_print(symtbl sym){
	#ifdef SINK_DEBUG
	frame_print(sym->fr);
	scope_print(sym->sc);
	#endif
}

static inline symtbl symtbl_new(bool repl){
	symtbl sym = mem_alloc(sizeof(symtbl_st));
	sym->fr = frame_new(NULL);
	sym->sc = scope_new(sym->fr, NULL, NULL, NULL);
	sym->repl = repl;
	return sym;
}

typedef struct {
	bool ok;
	union {
		namespace ns;
		char *msg;
	} u;
} sfn_st;

static inline sfn_st sfn_ok(namespace ns){
	return (sfn_st){ .ok = true, .u.ns = ns };
}

static inline sfn_st sfn_error(char *msg){
	return (sfn_st){ .ok = false, .u.msg = msg };
}

static sfn_st symtbl_findNamespace(symtbl sym, list_ptr names, int max){
	namespace ns = sym->sc->ns;
	for (int ni = 0; ni < max; ni++){
		list_byte name = names->ptrs[ni];
		bool found = false;
		for (int i = 0; i < ns->names->size; i++){
			nsname nsn = ns->names->ptrs[i];
			if (list_byte_equ(nsn->name, name)){
				if (nsn->type != NSN_NAMESPACE){
					if (!sym->repl){
						return sfn_error(format(
							"Not a namespace: \"%.*s\"", nsn->name->size, nsn->name->bytes));
					}
					nsname_free(ns->names->ptrs[i]);
					nsn = ns->names->ptrs[i] = nsname_namespace(nsn->name, namespace_new(ns->fr));
				}
				ns = nsn->u.ns;
				found = true;
				break;
			}
		}
		if (!found){
			namespace nns = namespace_new(ns->fr);
			list_ptr_push(ns->names, nsname_namespace(name, nns));
			ns = nns;
		}
	}
	return sfn_ok(ns);
}

static inline char *symtbl_pushNamespace(symtbl sym, list_ptr names){
	namespace ns;
	if (names == INCL_UNIQUE){
		// create a unique namespace and use it (via `using`) immediately
		namespace nsp = sym->sc->ns;
		ns = namespace_new(nsp->fr);
		list_ptr_push(nsp->names, nsname_namespacegive(list_byte_newstr("."), ns));
		list_ptr_push(nsp->usings, ns);
	}
	else{
		// find (and create if non-existant) namespace
		sfn_st nsr = symtbl_findNamespace(sym, names, names->size);
		if (!nsr.ok)
			return nsr.u.msg;
		ns = nsr.u.ns;
	}
	list_ptr_push(sym->sc->nsStack, ns);
	sym->sc->ns = ns;
	return NULL;
}

static inline void symtbl_popNamespace(symtbl sym){
	sym->sc->nsStack->size--;
	sym->sc->ns = sym->sc->nsStack->ptrs[sym->sc->nsStack->size - 1];
}

static inline void symtbl_pushScope(symtbl sym){
	sym->sc = scope_new(sym->fr, sym->sc->lblBreak, sym->sc->lblContinue, sym->sc);
}

static inline char *symtbl_popScope(symtbl sym){
	if (sym->sc->declares->size > 0){
		scopedecl scd = sym->sc->declares->ptrs[0];
		return format("Failed to define `%s`, declared at %d:%d",
			scd->hint, scd->flp.line, scd->flp.chr);
	}
	scope del = sym->sc;
	sym->sc = sym->sc->parent;
	scope_free(del);
	return NULL;
}

static inline void symtbl_pushFrame(symtbl sym){
	sym->fr = frame_new(sym->fr);
	sym->sc = scope_new(sym->fr, NULL, NULL, sym->sc);
}

static inline char *symtbl_popFrame(symtbl sym){
	char *err = symtbl_popScope(sym);
	if (err)
		return err;
	for (int i = 0; i < sym->fr->lbls->size; i++){
		label lbl = sym->fr->lbls->ptrs[i];
		if (lbl->pos < 0)
			return format("Missing label '%.*s'", lbl->name->size, lbl->name->bytes);
	}
	frame del = sym->fr;
	sym->fr = sym->fr->parent;
	frame_free(del);
	return NULL;
}

typedef struct {
	bool ok;
	union {
		nsname nsn;
		char *msg;
	} u;
} stl_st;

static inline stl_st stl_ok(nsname nsn){
	return (stl_st){ .ok = true, .u.nsn = nsn };
}

static inline stl_st stl_error(char *msg){
	return (stl_st){ .ok = false, .u.msg = msg };
}

static stl_st symtbl_lookupfast(symtbl sym, list_ptr names){
	list_ptr tried = list_ptr_new(NULL);
	scope trysc = sym->sc;
	while (trysc != NULL){
		for (int trynsi = trysc->nsStack->size - 1; trynsi >= 0; trynsi--){
			namespace tryns = trysc->nsStack->ptrs[trynsi];
			nl_st n = namespace_lookup(tryns, names, 0, tried);
			if (n.found){
				list_ptr_free(tried);
				return stl_ok(n.nsn);
			}
		}
		trysc = trysc->parent;
	}
	list_ptr_free(tried);
	return stl_error(NULL); // don't create an error message (unless we need it)
}

static stl_st symtbl_lookup(symtbl sym, list_ptr names){
	stl_st res = symtbl_lookupfast(sym, names);
	if (!res.ok){
		// create an error message
		list_byte lb = names->ptrs[0];
		char *join = format("Not found: %.*s", lb->size, lb->bytes);
		for (int i = 1; i < names->size; i++){
			lb = names->ptrs[i];
			char *join2 = format("%s.%.*s", join, lb->size, lb->bytes);
			mem_free(join);
			join = join2;
		}
		res.u.msg = join;
	}
	return res;
}

typedef struct {
	bool ok;
	union {
		varloc_st vlc;
		char *msg;
	} u;
} sta_st;

static inline sta_st sta_ok(varloc_st vlc){
	return (sta_st){ .ok = true, .u.vlc = vlc };
}

static inline sta_st sta_error(char *msg){
	return (sta_st){ .ok = false, .u.msg = msg };
}

static sta_st symtbl_addTemp(symtbl sym){
	for (int i = 0; i < sym->fr->vars->size; i++){
		if (sym->fr->vars->vals[i] == FVR_TEMP_AVAIL){
			sym->fr->vars->vals[i] = FVR_TEMP_INUSE;
			return sta_ok(varloc_new(sym->fr->level, i));
		}
	}
	if (sym->fr->vars->size >= 256)
		return sta_error(format("Too many variables in frame"));
	list_int_push(sym->fr->vars, FVR_TEMP_INUSE);
	return sta_ok(varloc_new(sym->fr->level, sym->fr->vars->size - 1));
}

static inline void symtbl_clearTemp(symtbl sym, varloc_st vlc){
	assert(!varloc_isnull(vlc));
	if (vlc.frame == sym->fr->level && sym->fr->vars->vals[vlc.index] == FVR_TEMP_INUSE)
		sym->fr->vars->vals[vlc.index] = FVR_TEMP_AVAIL;
}

static inline int symtbl_tempAvail(symtbl sym){
	int cnt = 256 - sym->fr->vars->size;
	for (int i = 0; i < sym->fr->vars->size; i++){
		if (sym->fr->vars->vals[i] == FVR_TEMP_AVAIL)
			cnt++;
	}
	return cnt;
}

static sta_st symtbl_addVar(symtbl sym, list_ptr names, int slot){
	// set `slot` to negative to add variable at next available location
	sfn_st nsr = symtbl_findNamespace(sym, names, names->size - 1);
	if (!nsr.ok)
		return sta_error(nsr.u.msg);
	namespace ns = nsr.u.ns;
	for (int i = 0; i < ns->names->size; i++){
		nsname nsn = ns->names->ptrs[i];
		if (list_byte_equ(nsn->name, names->ptrs[names->size - 1])){
			if (!sym->repl){
				return sta_error(
					format("Cannot redefine \"%.*s\"", nsn->name->size, nsn->name->bytes));
			}
			if (nsn->type == NSN_VAR)
				return sta_ok(varloc_new(nsn->u.var.fr->level, nsn->u.var.index));
			if (slot < 0){
				slot = sym->fr->vars->size;
				list_int_push(sym->fr->vars, FVR_VAR);
			}
			if (slot >= 256)
				return sta_error(format("Too many variables in frame"));
			nsname_free(ns->names->ptrs[i]);
			ns->names->ptrs[i] = nsname_var(names->ptrs[names->size - 1], sym->fr, slot);
			return sta_ok(varloc_new(sym->fr->level, slot));
		}
	}
	if (slot < 0){
		slot = sym->fr->vars->size;
		list_int_push(sym->fr->vars, FVR_VAR);
	}
	if (slot >= 256)
		return sta_error(format("Too many variables in frame"));
	list_ptr_push(ns->names, nsname_var(names->ptrs[names->size - 1], sym->fr, slot));
	return sta_ok(varloc_new(sym->fr->level, slot));
}

static char *symtbl_addEnum(symtbl sym, list_ptr names, double val){
	sfn_st nsr = symtbl_findNamespace(sym, names, names->size - 1);
	if (!nsr.ok)
		return nsr.u.msg;
	namespace ns = nsr.u.ns;
	for (int i = 0; i < ns->names->size; i++){
		nsname nsn = ns->names->ptrs[i];
		if (list_byte_equ(nsn->name, names->ptrs[names->size - 1])){
			if (!sym->repl)
				return format("Cannot redefine \"%.*s\"", nsn->name->size, nsn->name->bytes);
			nsname_free(ns->names->ptrs[i]);
			ns->names->ptrs[i] = nsname_enum(names->ptrs[names->size - 1], val, false);
			return NULL;
		}
	}
	list_ptr_push(ns->names, nsname_enum(names->ptrs[names->size - 1], val, false));
	return NULL;
}

static void symtbl_reserveVars(symtbl sym, int count){
	// reserves the slots 0 to count-1 for arguments to be passed in for commands
	for (int i = 0; i < count; i++)
		list_int_push(sym->fr->vars, FVR_VAR);
}

static char *symtbl_addCmdLocal(symtbl sym, list_ptr names, label lbl){
	sfn_st nsr = symtbl_findNamespace(sym, names, names->size - 1);
	if (!nsr.ok)
		return nsr.u.msg;
	namespace ns = nsr.u.ns;
	for (int i = 0; i < ns->names->size; i++){
		nsname nsn = ns->names->ptrs[i];
		if (list_byte_equ(nsn->name, names->ptrs[names->size - 1])){
			if (!sym->repl)
				return format("Cannot redefine \"%.*s\"", nsn->name->size, nsn->name->bytes);
			nsname_free(ns->names->ptrs[i]);
			ns->names->ptrs[i] = nsname_cmdLocal(names->ptrs[names->size - 1], sym->fr, lbl);
			return NULL;
		}
	}
	list_ptr_push(ns->names, nsname_cmdLocal(names->ptrs[names->size - 1], sym->fr, lbl));
	return NULL;
}

static char *symtbl_addCmdNative(symtbl sym, list_ptr names, uint64_t hash){
	sfn_st nsr = symtbl_findNamespace(sym, names, names->size - 1);
	if (!nsr.ok)
		return nsr.u.msg;
	namespace ns = nsr.u.ns;
	for (int i = 0; i < ns->names->size; i++){
		nsname nsn = ns->names->ptrs[i];
		if (list_byte_equ(nsn->name, names->ptrs[names->size - 1])){
			if (!sym->repl)
				return format("Cannot redefine \"%.*s\"", nsn->name->size, nsn->name->bytes);
			nsname_free(ns->names->ptrs[i]);
			ns->names->ptrs[i] = nsname_cmdNative(names->ptrs[names->size - 1], hash);
			return NULL;
		}
	}
	list_ptr_push(ns->names, nsname_cmdNative(names->ptrs[names->size - 1], hash));
	return NULL;
}

// symtbl_addCmdOpcode
// can simplify this function because it is only called internally
static inline void SAC(symtbl sym, const char *name, op_enum opcode, int params){
	list_ptr_push(sym->sc->ns->names, nsname_cmdOpcode(list_byte_newstr(name), opcode, params));
}

static inline void SAE(symtbl sym, const char *name, double val){
	list_ptr_push(sym->sc->ns->names, nsname_enum(list_byte_newstr(name), val, true));
}

static inline list_ptr NSS(const char *str){
	return list_ptr_newsingle((sink_free_f)list_byte_free, list_byte_newstr(str));
}

typedef enum {
	STRUCT_U8   =  1,
	STRUCT_U16  =  2,
	STRUCT_UL16 =  3,
	STRUCT_UB16 =  4,
	STRUCT_U32  =  5,
	STRUCT_UL32 =  6,
	STRUCT_UB32 =  7,
	STRUCT_S8   =  8,
	STRUCT_S16  =  9,
	STRUCT_SL16 = 10,
	STRUCT_SB16 = 11,
	STRUCT_S32  = 12,
	STRUCT_SL32 = 13,
	STRUCT_SB32 = 14,
	STRUCT_F32  = 15,
	STRUCT_FL32 = 16,
	STRUCT_FB32 = 17,
	STRUCT_F64  = 18,
	STRUCT_FL64 = 19,
	STRUCT_FB64 = 20
} struct_enum;

static inline void symtbl_loadStdlib(symtbl sym){
	list_ptr nss;
	SAC(sym, "say"           , OP_SAY            , -1);
	SAC(sym, "warn"          , OP_WARN           , -1);
	SAC(sym, "ask"           , OP_ASK            , -1);
	SAC(sym, "exit"          , OP_EXIT           , -1);
	SAC(sym, "abort"         , OP_ABORT          , -1);
	SAC(sym, "isnum"         , OP_ISNUM          ,  1);
	SAC(sym, "isstr"         , OP_ISSTR          ,  1);
	SAC(sym, "islist"        , OP_ISLIST         ,  1);
	SAC(sym, "isnative"      , OP_ISNATIVE       ,  1);
	SAC(sym, "range"         , OP_RANGE          ,  3);
	SAC(sym, "order"         , OP_ORDER          ,  2);
	SAC(sym, "pick"          , OP_PICK           ,  3);
	SAC(sym, "embed"         , OP_EMBED          ,  1);
	SAC(sym, "stacktrace"    , OP_STACKTRACE     ,  0);
	nss = NSS("num"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "abs"       , OP_NUM_ABS        ,  1);
		SAC(sym, "sign"      , OP_NUM_SIGN       ,  1);
		SAC(sym, "max"       , OP_NUM_MAX        , -1);
		SAC(sym, "min"       , OP_NUM_MIN        , -1);
		SAC(sym, "clamp"     , OP_NUM_CLAMP      ,  3);
		SAC(sym, "floor"     , OP_NUM_FLOOR      ,  1);
		SAC(sym, "ceil"      , OP_NUM_CEIL       ,  1);
		SAC(sym, "round"     , OP_NUM_ROUND      ,  1);
		SAC(sym, "trunc"     , OP_NUM_TRUNC      ,  1);
		SAC(sym, "nan"       , OP_NUM_NAN        ,  0);
		SAC(sym, "inf"       , OP_NUM_INF        ,  0);
		SAC(sym, "isnan"     , OP_NUM_ISNAN      ,  1);
		SAC(sym, "isfinite"  , OP_NUM_ISFINITE   ,  1);
		SAE(sym, "e"         , sink_num_e().f        );
		SAE(sym, "pi"        , sink_num_pi().f       );
		SAE(sym, "tau"       , sink_num_tau().f      );
		SAC(sym, "sin"       , OP_NUM_SIN        ,  1);
		SAC(sym, "cos"       , OP_NUM_COS        ,  1);
		SAC(sym, "tan"       , OP_NUM_TAN        ,  1);
		SAC(sym, "asin"      , OP_NUM_ASIN       ,  1);
		SAC(sym, "acos"      , OP_NUM_ACOS       ,  1);
		SAC(sym, "atan"      , OP_NUM_ATAN       ,  1);
		SAC(sym, "atan2"     , OP_NUM_ATAN2      ,  2);
		SAC(sym, "log"       , OP_NUM_LOG        ,  1);
		SAC(sym, "log2"      , OP_NUM_LOG2       ,  1);
		SAC(sym, "log10"     , OP_NUM_LOG10      ,  1);
		SAC(sym, "exp"       , OP_NUM_EXP        ,  1);
		SAC(sym, "lerp"      , OP_NUM_LERP       ,  3);
		SAC(sym, "hex"       , OP_NUM_HEX        ,  2);
		SAC(sym, "oct"       , OP_NUM_OCT        ,  2);
		SAC(sym, "bin"       , OP_NUM_BIN        ,  2);
	symtbl_popNamespace(sym);
	nss = NSS("int"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "new"       , OP_INT_NEW        ,  1);
		SAC(sym, "not"       , OP_INT_NOT        ,  1);
		SAC(sym, "and"       , OP_INT_AND        , -1);
		SAC(sym, "or"        , OP_INT_OR         , -1);
		SAC(sym, "xor"       , OP_INT_XOR        , -1);
		SAC(sym, "shl"       , OP_INT_SHL        ,  2);
		SAC(sym, "shr"       , OP_INT_SHR        ,  2);
		SAC(sym, "sar"       , OP_INT_SAR        ,  2);
		SAC(sym, "add"       , OP_INT_ADD        ,  2);
		SAC(sym, "sub"       , OP_INT_SUB        ,  2);
		SAC(sym, "mul"       , OP_INT_MUL        ,  2);
		SAC(sym, "div"       , OP_INT_DIV        ,  2);
		SAC(sym, "mod"       , OP_INT_MOD        ,  2);
		SAC(sym, "clz"       , OP_INT_CLZ        ,  1);
		SAC(sym, "pop"       , OP_INT_POP        ,  1);
		SAC(sym, "bswap"     , OP_INT_BSWAP      ,  1);
	symtbl_popNamespace(sym);
	nss = NSS("rand"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "seed"      , OP_RAND_SEED      ,  1);
		SAC(sym, "seedauto"  , OP_RAND_SEEDAUTO  ,  0);
		SAC(sym, "int"       , OP_RAND_INT       ,  0);
		SAC(sym, "num"       , OP_RAND_NUM       ,  0);
		SAC(sym, "range"     , OP_RAND_RANGE     ,  3);
		SAC(sym, "getstate"  , OP_RAND_GETSTATE  ,  0);
		SAC(sym, "setstate"  , OP_RAND_SETSTATE  ,  1);
		SAC(sym, "pick"      , OP_RAND_PICK      ,  1);
		SAC(sym, "shuffle"   , OP_RAND_SHUFFLE   ,  1);
	symtbl_popNamespace(sym);
	nss = NSS("str"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "new"       , OP_STR_NEW        , -1);
		SAC(sym, "split"     , OP_STR_SPLIT      ,  2);
		SAC(sym, "replace"   , OP_STR_REPLACE    ,  3);
		SAC(sym, "begins"    , OP_STR_BEGINS     ,  2);
		SAC(sym, "ends"      , OP_STR_ENDS       ,  2);
		SAC(sym, "pad"       , OP_STR_PAD        ,  2);
		SAC(sym, "find"      , OP_STR_FIND       ,  3);
		SAC(sym, "rfind"     , OP_STR_RFIND      ,  3);
		SAC(sym, "lower"     , OP_STR_LOWER      ,  1);
		SAC(sym, "upper"     , OP_STR_UPPER      ,  1);
		SAC(sym, "trim"      , OP_STR_TRIM       ,  1);
		SAC(sym, "rev"       , OP_STR_REV        ,  1);
		SAC(sym, "rep"       , OP_STR_REP        ,  2);
		SAC(sym, "list"      , OP_STR_LIST       ,  1);
		SAC(sym, "byte"      , OP_STR_BYTE       ,  2);
		SAC(sym, "hash"      , OP_STR_HASH       ,  2);
	symtbl_popNamespace(sym);
	nss = NSS("utf8"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "valid"     , OP_UTF8_VALID     ,  1);
		SAC(sym, "list"      , OP_UTF8_LIST      ,  1);
		SAC(sym, "str"       , OP_UTF8_STR       ,  1);
	symtbl_popNamespace(sym);
	nss = NSS("struct"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "size"      , OP_STRUCT_SIZE    ,  1);
		SAC(sym, "str"       , OP_STRUCT_STR     ,  2);
		SAC(sym, "list"      , OP_STRUCT_LIST    ,  2);
		SAC(sym, "isLE"      , OP_STRUCT_ISLE    ,  0);
		SAE(sym, "U8"        , STRUCT_U8             );
		SAE(sym, "U16"       , STRUCT_U16            );
		SAE(sym, "UL16"      , STRUCT_UL16           );
		SAE(sym, "UB16"      , STRUCT_UB16           );
		SAE(sym, "U32"       , STRUCT_U32            );
		SAE(sym, "UL32"      , STRUCT_UL32           );
		SAE(sym, "UB32"      , STRUCT_UB32           );
		SAE(sym, "S8"        , STRUCT_S8             );
		SAE(sym, "S16"       , STRUCT_S16            );
		SAE(sym, "SL16"      , STRUCT_SL16           );
		SAE(sym, "SB16"      , STRUCT_SB16           );
		SAE(sym, "S32"       , STRUCT_S32            );
		SAE(sym, "SL32"      , STRUCT_SL32           );
		SAE(sym, "SB32"      , STRUCT_SB32           );
		SAE(sym, "F32"       , STRUCT_F32            );
		SAE(sym, "FL32"      , STRUCT_FL32           );
		SAE(sym, "FB32"      , STRUCT_FB32           );
		SAE(sym, "F64"       , STRUCT_F64            );
		SAE(sym, "FL64"      , STRUCT_FL64           );
		SAE(sym, "FB64"      , STRUCT_FB64           );
	symtbl_popNamespace(sym);
	nss = NSS("list"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "new"       , OP_LIST_NEW       ,  2);
		SAC(sym, "shift"     , OP_LIST_SHIFT     ,  1);
		SAC(sym, "pop"       , OP_LIST_POP       ,  1);
		SAC(sym, "push"      , OP_LIST_PUSH      ,  2);
		SAC(sym, "unshift"   , OP_LIST_UNSHIFT   ,  2);
		SAC(sym, "append"    , OP_LIST_APPEND    ,  2);
		SAC(sym, "prepend"   , OP_LIST_PREPEND   ,  2);
		SAC(sym, "find"      , OP_LIST_FIND      ,  3);
		SAC(sym, "rfind"     , OP_LIST_RFIND     ,  3);
		SAC(sym, "join"      , OP_LIST_JOIN      ,  2);
		SAC(sym, "rev"       , OP_LIST_REV       ,  1);
		SAC(sym, "str"       , OP_LIST_STR       ,  1);
		SAC(sym, "sort"      , OP_LIST_SORT      ,  1);
		SAC(sym, "rsort"     , OP_LIST_RSORT     ,  1);
	symtbl_popNamespace(sym);
	nss = NSS("pickle"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "json"      , OP_PICKLE_JSON    ,  1);
		SAC(sym, "bin"       , OP_PICKLE_BIN     ,  1);
		SAC(sym, "val"       , OP_PICKLE_VAL     ,  1);
		SAC(sym, "valid"     , OP_PICKLE_VALID   ,  1);
		SAC(sym, "sibling"   , OP_PICKLE_SIBLING ,  1);
		SAC(sym, "circular"  , OP_PICKLE_CIRCULAR,  1);
		SAC(sym, "copy"      , OP_PICKLE_COPY    ,  1);
	symtbl_popNamespace(sym);
	nss = NSS("gc"); symtbl_pushNamespace(sym, nss); list_ptr_free(nss);
		SAC(sym, "getlevel"  , OP_GC_GETLEVEL    ,  0);
		SAC(sym, "setlevel"  , OP_GC_SETLEVEL    ,  1);
		SAC(sym, "run"       , OP_GC_RUN         ,  0);
		SAE(sym, "NONE"      , SINK_GC_NONE          );
		SAE(sym, "DEFAULT"   , SINK_GC_DEFAULT       );
		SAE(sym, "LOWMEM"    , SINK_GC_LOWMEM        );
	symtbl_popNamespace(sym);
}

//
// structures
//

typedef struct {
	list_ptr strTable;
	list_u64 keyTable;
	list_ptr debugTable;
	list_ptr posTable;
	list_ptr cmdTable;
	list_byte ops;
	bool posix;
	bool repl;
} program_st, *program;

typedef struct {
	enum {
		BIS_HEADER,
		BIS_STR_HEAD,
		BIS_STR_BODY,
		BIS_KEY,
		BIS_DEBUG_HEAD,
		BIS_DEBUG_BODY,
		BIS_POS,
		BIS_CMD,
		BIS_OPS,
		BIS_DONE
	} state;
	int str_size; // strTable
	int key_size; // keyTable
	int dbg_size; // debugTable
	int pos_size; // posTable
	int cmd_size; // cmdTable
	int ops_size; // ops
	int left; // size left to read
	int item; // item count for the various tables
	list_byte buf;
} binstate_st;

typedef struct compiler_struct compiler_st, *compiler;
typedef struct staticinc_struct staticinc_st, *staticinc;
typedef struct {
	void *user;
	sink_free_f f_freeuser;
	program prg;
	compiler cmp;
	staticinc sinc;
	cleanup cup;
	list_ptr files;
	list_ptr paths;
	sink_inc_st inc;
	list_byte capture_write;
	char *curdir;
	char *file;
	char *err;
	enum {
		SCM_UNKNOWN,
		SCM_BINARY,
		SCM_TEXT
	} mode;
	binstate_st binstate;
	bool posix;
} script_st, *script;

//
// pathjoin
//

static inline bool issep(char ch, bool posix){
	return ch == '/' || (!posix && ch == '\\');
}

static void pathjoin_apply(char *res, int *r, int len, const char *buf, bool posix){
	if (len <= 0 || (len == 1 && buf[0] == '.'))
		return;
	if (len == 2 && buf[0] == '.' && buf[1] == '.'){
		for (int i = *r - 1; i >= 0; i--){
			if (issep(res[i], posix)){
				*r = i;
				return;
			}
		}
		return;
	}
	if (posix)
		res[(*r)++] = '/';
	else{
		if (*r) // if in middle of windows path
			res[(*r)++] = '\\'; // just join with backslash
		else if (len < 2 || buf[1] != ':'){ // otherwise, if we're starting a \\host path
			// add the initial double backslashes
			res[(*r)++] = '\\';
			res[(*r)++] = '\\';
		}
		// otherwise, we're starting a drive path, so don't prefix the drive with anything
	}
	for (int i = 0; i < len; i++)
		res[(*r)++] = buf[i];
}

static void pathjoin_helper(char *res, int *r, int len, const char *buf, bool posix){
	for (int i = 0; i < len; i++){
		if (issep(buf[i], posix))
			continue;
		int start = i;
		while (i < len && !issep(buf[i], posix))
			i++;
		pathjoin_apply(res, r, i - start, &buf[start], posix);
	}
}

static char *pathjoin(const char *prev, const char *next, bool posix){
	int prev_len = (int)strlen(prev);
	int next_len = (int)strlen(next);
	int len = prev_len + next_len + 4;
	char *res = mem_alloc(sizeof(char) * len);
	int r = 0;
	pathjoin_helper(res, &r, prev_len, prev, posix);
	pathjoin_helper(res, &r, next_len, next, posix);
	res[r++] = 0;
	return res;
}

//
// file resolver
//

typedef bool (*f_fileres_begin_f)(const char *file, void *fuser);
typedef void (*f_fileres_end_f)(bool success, const char *file, void *fuser);

static bool fileres_try(script scr, bool postfix, const char *file,
	f_fileres_begin_f f_begin, f_fileres_end_f f_end, void *fuser){
	sink_inc_st inc = scr->inc;
	if (file == NULL)
		return false;
	sink_fstype fst = inc.f_fstype(scr, file, inc.user);
	bool result = false;
	switch (fst){
		case SINK_FSTYPE_FILE: {
			result = true;
			if (f_begin(file, fuser))
				f_end(inc.f_fsread(scr, file, inc.user), file, fuser);
		} break;
		case SINK_FSTYPE_NONE: {
			if (!postfix)
				break;
			// try adding a .sink extension
			int len = (int)strlen(file);
			if (len < 5 || strcmp(&file[len - 5], ".sink") != 0){
				char *cat = mem_alloc(sizeof(char) * (len + 6));
				memcpy(cat, file, sizeof(char) * len);
				cat[len + 0] = '.';
				cat[len + 1] = 's';
				cat[len + 2] = 'i';
				cat[len + 3] = 'n';
				cat[len + 4] = 'k';
				cat[len + 5] = 0;
				result = fileres_try(scr, false, cat, f_begin, f_end, fuser);
				mem_free(cat);
			}
		} break;
		case SINK_FSTYPE_DIR: {
			if (!postfix)
				break;
			// try looking for index.sink inside the directory
			char *join = pathjoin(file, "index.sink", scr->posix);
			result = fileres_try(scr, false, join, f_begin, f_end, fuser);
			mem_free(join);
		} break;
	}
	return result;
}

static inline bool isabs(const char *file, bool posix){
	return (posix && file[0] == '/') ||
		(!posix && file[0] != 0 && (file[1] == ':' || (file[0] == '\\' && file[1] == '\\')));
}

static bool fileres_read(script scr, bool postfix, const char *file, const char *cwd,
	f_fileres_begin_f f_begin, f_fileres_end_f f_end, void *fuser){
	// if an absolute path, there is no searching, so just try to read it directly
	if (isabs(file, scr->posix))
		return fileres_try(scr, postfix, file, f_begin, f_end, fuser);
	// otherwise, we have a relative path, so we need to go through our search list
	if (cwd == NULL)
		cwd = scr->curdir;
	list_ptr paths = scr->paths;
	for (int i = 0; i < paths->size; i++){
		char *path = paths->ptrs[i];
		char *join;
		if (isabs(path, scr->posix)) // search path is absolute
			join = pathjoin(path, file, scr->posix);
		else{ // search path is relative
			if (cwd == NULL)
				continue;
			char *tmp = pathjoin(cwd, path, scr->posix);
			join = pathjoin(tmp, file, scr->posix);
			mem_free(tmp);
		}
		bool found = fileres_try(scr, postfix, join, f_begin, f_end, fuser);
		mem_free(join);
		if (found)
			return true;
	}
	return false;
}

//
// program
//

static inline void program_free(program prg){
	list_ptr_free(prg->strTable);
	list_u64_free(prg->keyTable);
	list_ptr_free(prg->debugTable);
	list_ptr_free(prg->posTable);
	list_ptr_free(prg->cmdTable);
	list_byte_free(prg->ops);
	mem_free(prg);
}

static inline program program_new(bool posix, bool repl){
	program prg = mem_alloc(sizeof(program_st));
	prg->strTable = list_ptr_new(list_byte_free);
	prg->keyTable = list_u64_new();
	prg->debugTable = list_ptr_new(mem_free_func);
	prg->posTable = list_ptr_new(mem_free_func);
	prg->cmdTable = list_ptr_new(mem_free_func);
	prg->ops = list_byte_new();
	prg->posix = posix;
	prg->repl = repl;
	return prg;
}

static int program_adddebugstr(program prg, const char *str){
	for (int i = 0; i < prg->debugTable->size; i++){
		if (strcmp(prg->debugTable->ptrs[i], str) == 0)
			return i;
	}
	list_ptr_push(prg->debugTable, format("%s", str));
	return prg->debugTable->size - 1;
}

static int program_addfile(program prg, const char *str){
	if (str == NULL)
		return -1;
	// get the basename
	int len = strlen(str);
	int i = 0;
	for (i = len - 2; i > 0; i--){
		if (issep(str[i], prg->posix)){
			i++;
			break;
		}
	}
	return program_adddebugstr(prg, &str[i]);
}

static inline const char *program_getdebugstr(program prg, int str){
	return str < 0 ? NULL : prg->debugTable->ptrs[str];
}

static char *program_errormsg(program prg, filepos_st flp, const char *msg){
	if (msg == NULL){
		if (flp.basefile < 0)
			return format("%d:%d", flp.line, flp.chr);
		return format("%s:%d:%d", program_getdebugstr(prg, flp.basefile), flp.line, flp.chr);
	}
	if (flp.basefile < 0)
		return format("%d:%d: %s", flp.line, flp.chr, msg);
	return format("%s:%d:%d: %s",
		program_getdebugstr(prg, flp.basefile), flp.line, flp.chr, msg);
}

static bool program_validate(program prg){
	int pc = 0;
	int level = 0;
	bool wasjump = false;
	uint32_t jumploc;
	uint32_t jumplocs[256];
	list_byte ops = prg->ops;
	int A, B, C, D;

	// holds alignment information
	// op_actual: the actual alignment of each byte
	//   0 = invalid target, 1 = valid jump target, 2 = valid call target
	uint8_t *op_actual = mem_alloc(sizeof(uint8_t) * ops->size);
	memset(op_actual, 0, sizeof(uint8_t) * ops->size);
	// op_need: the required alignment of each byte
	//   0 = don't care, 1 = valid jump target, 2 = valid call target
	uint8_t *op_need = mem_alloc(sizeof(uint8_t) * ops->size);
	memset(op_need, 0, sizeof(uint8_t) * ops->size);

	#define READVAR() do{                                              \
			if (pc + 2 > ops->size)                                    \
				goto fail;                                             \
			A = ops->bytes[pc++];                                      \
			B = ops->bytes[pc++];                                      \
			if (A > level)                                             \
				goto fail;                                             \
		} while (false)

	#define READLOC(L) do{                                             \
			if (pc + 4 > ops->size)                                    \
				goto fail;                                             \
			A = ops->bytes[pc++];                                      \
			B = ops->bytes[pc++];                                      \
			C = ops->bytes[pc++];                                      \
			D = ops->bytes[pc++];                                      \
			jumploc = A + (B << 8) + (C << 16) + ((D << 23) * 2);      \
			if (jumploc >= 0x80000000)                                 \
				goto fail;                                             \
			if (jumploc < ops->size)                                   \
				op_need[jumploc] = L;                                  \
		} while (false)

	#define READDATA(S) do{                                            \
			if (pc + S > ops->size)                                    \
				goto fail;                                             \
			pc += S;                                                   \
		} while (false)

	#define READCNT() do{                                              \
			if (pc + 1 > ops->size)                                    \
				goto fail;                                             \
			C = ops->bytes[pc++];                                      \
			for (D = 0; D < C; D++)                                    \
				READVAR();                                             \
		} while (false)

	#define READINDEX() do{                                            \
			if (pc + 4 > ops->size)                                    \
				goto fail;                                             \
			A = ops->bytes[pc++];                                      \
			B = ops->bytes[pc++];                                      \
			C = ops->bytes[pc++];                                      \
			D = ops->bytes[pc++];                                      \
			A = A + (B << 8) + (C << 16) + ((D << 23) * 2);            \
		} while (false)

	while (pc < ops->size){
		op_actual[pc] = 1;
		op_pcat opc = op_paramcat((op_enum)ops->bytes[pc++]);
		debug(op_pcat_name(opc));
		switch (opc){
			case OPPC_INVALID    : goto fail;

			case OPPC_STR        : { // [VAR], [[INDEX]]
				READVAR();
				READINDEX();
				if (A < 0 || A >= prg->strTable->size)
					goto fail;
			} break;

			case OPPC_CMDHEAD    : { // LEVEL, RESTPOS
				if (!wasjump)
					goto fail;
				if (pc + 2 > ops->size)
					goto fail;
				op_actual[pc - 1] = 2; // valid call target
				if (level > 255)
					goto fail;
				jumplocs[level++] = jumploc; // save previous jump target
				A = ops->bytes[pc++];
				B = ops->bytes[pc++];
				if (A != level)
					goto fail;
			} break;

			case OPPC_CMDTAIL    : { //
				if (level <= 0)
					goto fail;
				if (jumplocs[--level] != pc) // force jump target to jump over command body
					goto fail;
			} break;

			case OPPC_JUMP       : { // [[LOCATION]]
				READLOC(1); // need valid jump target
			} break;

			case OPPC_VJUMP      : { // [VAR], [[LOCATION]]
				READVAR();
				READLOC(1); // need valid jump target
			} break;

			case OPPC_CALL       : { // [VAR], [[LOCATION]], ARGCOUNT, [VARS]...
				READVAR();
				READLOC(2); // need valid call target
				READCNT();
			} break;

			case OPPC_ISNATIVE   : { // [VAR], [[INDEX]]
				READVAR();
				READINDEX();
				if (A < 0 || A >= prg->keyTable->size)
					goto fail;
			} break;

			case OPPC_NATIVE     : { // [VAR], [[INDEX]], ARGCOUNT, [VARS]...
				READVAR();
				READINDEX();
				if (A < 0 || A >= prg->keyTable->size)
					goto fail;
				READCNT();
			} break;

			case OPPC_RETURNTAIL : { // [[LOCATION]], ARGCOUNT, [VARS]...
				READLOC(2); // need valid call target
				READCNT();
				if (jumploc < ops->size - 1){
					// check that the call target's level matches this level
					if (ops->bytes[jumploc] != OP_CMDHEAD || ops->bytes[jumploc + 1] != level)
						goto fail;
				}
			} break;

			case OPPC_VVVV       :   // [VAR], [VAR], [VAR], [VAR]
				READVAR();
			case OPPC_VVV        :   // [VAR], [VAR], [VAR]
				READVAR();
			case OPPC_VV         :   // [VAR], [VAR]
				READVAR();
			case OPPC_V          :   // [VAR]
				READVAR();
			case OPPC_EMPTY      :   // nothing
				break;

			case OPPC_VA         : { // [VAR], ARGCOUNT, [VARS]...
				READVAR();
				READCNT();
			} break;

			case OPPC_VN         : { // [VAR], DATA
				READVAR();
				READDATA(1);
			} break;

			case OPPC_VNN        : { // [VAR], [DATA]
				READVAR();
				READDATA(2);
			} break;

			case OPPC_VNNNN      : { // [VAR], [[DATA]]
				READVAR();
				READDATA(4);
			} break;

			case OPPC_VNNNNNNNN  : { // [VAR], [[[DATA]]]
				READVAR();
				READDATA(8);
			} break;
		}
		wasjump = opc == OPPC_JUMP;
	}

	#undef READVAR
	#undef READLOC
	#undef READDATA
	#undef READCNT
	#undef READINDEX

	// validate op_need alignments matches op_actual alignments
	for (int i = 0; i < ops->size; i++){
		if (op_need[i] != 0 && op_need[i] != op_actual[i])
			goto fail;
	}

	mem_free(op_actual);
	mem_free(op_need);
	return true;

	fail:
	mem_free(op_actual);
	mem_free(op_need);
	return false;
}

typedef struct {
	int32_t pc;
	filepos_st flp;
} prgflp_st, *prgflp;

static inline void program_flp(program prg, filepos_st flp){
	int i = prg->posTable->size - 1;
	if (i >= 0){
		prgflp p = prg->posTable->ptrs[i];
		if (p->pc == prg->ops->size){
			p->flp = flp;
			#ifdef SINK_DEBUG
			char *str = program_errormsg(prg, flp, NULL);
			oplogf("#file %s", str);
			mem_free(str);
			#endif
			return;
		}
	}
	prgflp p = mem_alloc(sizeof(prgflp_st));
	p->pc = prg->ops->size;
	p->flp = flp;
	#ifdef SINK_DEBUG
	char *str = program_errormsg(prg, flp, NULL);
	oplogf("#file %s", str);
	mem_free(str);
	#endif
	list_ptr_push(prg->posTable, p);
}

typedef struct {
	int32_t pc;
	int32_t cmdhint;
} prgch_st, *prgch;

static inline void program_cmdhint(program prg, list_ptr names){
	char *hint = NULL;
	if (names){
		int hint_tot = 1;
		for (int i = 0; i < names->size; i++){
			list_byte n = names->ptrs[i];
			hint_tot += (i == 0 ? 0 : 1) + n->size;
		}
		hint = mem_alloc(sizeof(char) * hint_tot);
		hint_tot = 0;
		for (int i = 0; i < names->size; i++){
			if (i > 0)
				hint[hint_tot++] = '.';
			list_byte n = names->ptrs[i];
			memcpy(&hint[hint_tot], n->bytes, sizeof(char) * n->size);
			hint_tot += n->size;
		}
		hint[hint_tot] = 0;
		oplogf("#cmd %s", hint);
	}
	else{
		oplog("#cmd <tail>");
	}
	prgch p = mem_alloc(sizeof(prgch_st));
	p->pc = prg->ops->size;
	p->cmdhint = hint ? program_adddebugstr(prg, hint) : -1;
	if (hint)
		mem_free(hint);
	list_ptr_push(prg->cmdTable, p);
}

typedef struct {
	program prg;
	symtbl sym;
	script scr;
	int from;
} pgen_st;

typedef struct {
	bool ok;
	union {
		varloc_st vlc;
		struct {
			filepos_st flp;
			char *msg;
		} error;
	} u;
} per_st;

static inline per_st per_ok(varloc_st vlc){
	return (per_st){ .ok = true, .u.vlc = vlc };
}

static inline per_st per_error(filepos_st flp, char *msg){
	return (per_st){ .ok = false, .u.error.flp = flp, .u.error.msg = msg };
}

typedef enum {
	PEM_EMPTY,  // I don't need the value
	PEM_CREATE, // I need to read the value
	PEM_INTO    // I need to own the register
} pem_enum;

static per_st program_eval(pgen_st pgen, pem_enum mode, varloc_st intoVlc, expr ex);

typedef struct {
	bool ok;
	union {
		struct {
			varloc_st start;
			varloc_st len;
		} ok;
		struct {
			filepos_st flp;
			char *msg;
		} error;
	} u;
} psr_st;

static inline psr_st psr_ok(varloc_st start, varloc_st len){
	return (psr_st){ .ok = true, .u.ok.start = start, .u.ok.len = len };
}

static inline psr_st psr_error(filepos_st flp, char *msg){
	return (psr_st){ .ok = false, .u.error.flp = flp, .u.error.msg = msg };
}

static psr_st program_slice(pgen_st pgen, expr ex);

typedef enum {
	LVR_VAR,
	LVR_INDEX,
	LVR_SLICE,
	LVR_SLICEINDEX,
	LVR_LIST
} lvr_enum;

typedef struct lvr_struct lvr_st, *lvr;
struct lvr_struct {
	filepos_st flp;
	varloc_st vlc;
	lvr_enum type;
	union {
		struct {
			varloc_st obj;
			varloc_st key;
		} index;
		struct {
			varloc_st obj;
			varloc_st start;
			varloc_st len;
		} slice;
		struct {
			varloc_st indexvlc;
			varloc_st obj;
			varloc_st key;
			varloc_st start;
			varloc_st len;
		} sliceindex;
		struct {
			list_ptr body;
			lvr rest;
		} list;
	} u;
};

static inline void lvr_free(lvr lv){
	switch (lv->type){
		case LVR_VAR:
		case LVR_INDEX:
		case LVR_SLICE:
		case LVR_SLICEINDEX:
			break;
		case LVR_LIST:
			list_ptr_free(lv->u.list.body);
			if (lv->u.list.rest)
				lvr_free(lv->u.list.rest);
			break;
	}
	mem_free(lv);
}

static inline lvr lvr_var(filepos_st flp, varloc_st vlc){
	lvr lv = mem_alloc(sizeof(lvr_st));
	lv->flp = flp;
	lv->vlc = vlc;
	lv->type = LVR_VAR;
	return lv;
}

static inline lvr lvr_index(filepos_st flp, varloc_st obj, varloc_st key){
	lvr lv = mem_alloc(sizeof(lvr_st));
	lv->flp = flp;
	lv->vlc = VARLOC_NULL;
	lv->type = LVR_INDEX;
	lv->u.index.obj = obj;
	lv->u.index.key = key;
	return lv;
}

static inline lvr lvr_slice(filepos_st flp, varloc_st obj, varloc_st start, varloc_st len){
	lvr lv = mem_alloc(sizeof(lvr_st));
	lv->flp = flp;
	lv->vlc = VARLOC_NULL;
	lv->type = LVR_SLICE;
	lv->u.slice.obj = obj;
	lv->u.slice.start = start;
	lv->u.slice.len = len;
	return lv;
}

static inline lvr lvr_sliceindex(filepos_st flp, varloc_st obj, varloc_st key, varloc_st start,
	varloc_st len){
	lvr lv = mem_alloc(sizeof(lvr_st));
	lv->flp = flp;
	lv->vlc = VARLOC_NULL;
	lv->type = LVR_SLICEINDEX;
	lv->u.sliceindex.indexvlc = VARLOC_NULL;
	lv->u.sliceindex.obj = obj;
	lv->u.sliceindex.key = key;
	lv->u.sliceindex.start = start;
	lv->u.sliceindex.len = len;
	return lv;
}

static inline lvr lvr_list(filepos_st flp, list_ptr body, lvr rest){
	lvr lv = mem_alloc(sizeof(lvr_st));
	lv->flp = flp;
	lv->vlc = VARLOC_NULL;
	lv->type = LVR_LIST;
	lv->u.list.body = body;
	lv->u.list.rest = rest;
	return lv;
}

typedef enum {
	PLM_CREATE,
	PLM_INTO
} plm_enum;

static per_st program_lvalGet(pgen_st pgen, plm_enum mode, varloc_st intoVlc, lvr lv);
static per_st program_lvalGetIndex(pgen_st pgen, lvr lv);

typedef struct {
	bool ok;
	union {
		lvr lv;
		struct {
			filepos_st flp;
			char *msg;
		} error;
	} u;
} lvp_st;

static inline lvp_st lvp_ok(lvr lv){
	return (lvp_st){ .ok = true, .u.lv = lv };
}

static inline lvp_st lvp_error(filepos_st flp, char *msg){
	return (lvp_st){ .ok = false, .u.error.flp = flp, .u.error.msg = msg };
}

static lvp_st lval_addVars(symtbl sym, expr ex, int slot){
	if (ex->type == EXPR_NAMES){
		sta_st sr = symtbl_addVar(sym, ex->u.names, slot);
		if (!sr.ok)
			return lvp_error(ex->flp, sr.u.msg);
		return lvp_ok(lvr_var(ex->flp, sr.u.vlc));
	}
	else if (ex->type == EXPR_LIST){
		if (ex->u.ex == NULL)
			return lvp_error(ex->flp, format("Invalid assignment"));
		list_ptr body = list_ptr_new(lvr_free);
		lvr rest = NULL;
		if (ex->u.ex->type == EXPR_GROUP){
			for (int i = 0; i < ex->u.ex->u.group->size; i++){
				expr gex = ex->u.ex->u.group->ptrs[i];
				if (i == ex->u.ex->u.group->size - 1 && gex->type == EXPR_PREFIX &&
					gex->u.prefix.k == KS_PERIOD3){
					lvp_st lp = lval_addVars(sym, gex->u.prefix.ex, -1);
					if (!lp.ok)
						return lp;
					rest = lp.u.lv;
				}
				else{
					lvp_st lp = lval_addVars(sym, gex, -1);
					if (!lp.ok)
						return lp;
					list_ptr_push(body, lp.u.lv);
				}
			}
		}
		else if (ex->u.ex->type == EXPR_PREFIX && ex->u.ex->u.prefix.k == KS_PERIOD3){
			lvp_st lp = lval_addVars(sym, ex->u.ex->u.ex, -1);
			if (!lp.ok)
				return lp;
			rest = lp.u.lv;
		}
		else{
			lvp_st lp = lval_addVars(sym, ex->u.ex, -1);
			if (!lp.ok)
				return lp;
			list_ptr_push(body, lp.u.lv);
		}
		return lvp_ok(lvr_list(ex->flp, body, rest));
	}
	return lvp_error(ex->flp, format("Invalid assignment"));
}

static lvp_st lval_prepare(pgen_st pgen, expr ex){
	if (ex->type == EXPR_NAMES){
		stl_st sl = symtbl_lookup(pgen.sym, ex->u.names);
		if (!sl.ok)
			return lvp_error(ex->flp, sl.u.msg);
		if (sl.u.nsn->type != NSN_VAR)
			return lvp_error(ex->flp, format("Invalid assignment"));
		return lvp_ok(lvr_var(ex->flp,
			varloc_new(sl.u.nsn->u.var.fr->level, sl.u.nsn->u.var.index)));
	}
	else if (ex->type == EXPR_INDEX){
		per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.index.obj);
		if (!pe.ok)
			return lvp_error(pe.u.error.flp, pe.u.error.msg);
		varloc_st obj = pe.u.vlc;
		pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.index.key);
		if (!pe.ok)
			return lvp_error(pe.u.error.flp, pe.u.error.msg);
		return lvp_ok(lvr_index(ex->flp, obj, pe.u.vlc));
	}
	else if (ex->type == EXPR_SLICE){
		if (ex->u.slice.obj->type == EXPR_INDEX){
			// we have a slice of an index `foo[1][2:3]`
			per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL,
				ex->u.slice.obj->u.index.obj);
			if (!pe.ok)
				return lvp_error(pe.u.error.flp, pe.u.error.msg);
			varloc_st obj = pe.u.vlc;
			pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.slice.obj->u.index.key);
			if (!pe.ok)
				return lvp_error(pe.u.error.flp, pe.u.error.msg);
			varloc_st key = pe.u.vlc;
			psr_st sr = program_slice(pgen, ex);
			if (!sr.ok)
				return lvp_error(sr.u.error.flp, sr.u.error.msg);
			return lvp_ok(lvr_sliceindex(ex->flp, obj, key, sr.u.ok.start, sr.u.ok.len));
		}
		else{
			per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.slice.obj);
			if (!pe.ok)
				return lvp_error(pe.u.error.flp, pe.u.error.msg);
			varloc_st obj = pe.u.vlc;
			psr_st sr = program_slice(pgen, ex);
			if (!sr.ok)
				return lvp_error(sr.u.error.flp, sr.u.error.msg);
			return lvp_ok(lvr_slice(ex->flp, obj, sr.u.ok.start, sr.u.ok.len));
		}
	}
	else if (ex->type == EXPR_LIST){
		list_ptr body = list_ptr_new(lvr_free);
		lvr rest = NULL;
		if (ex->u.ex == NULL){
			list_ptr_free(body);
			return lvp_error(ex->flp, format("Invalid assignment"));
		}
		else if (ex->u.ex->type == EXPR_GROUP){
			for (int i = 0; i < ex->u.ex->u.group->size; i++){
				expr gex = ex->u.ex->u.group->ptrs[i];
				if (i == ex->u.ex->u.group->size - 1 && gex->type == EXPR_PREFIX &&
					gex->u.prefix.k == KS_PERIOD3){
					lvp_st lp = lval_prepare(pgen, gex->u.ex);
					if (!lp.ok){
						list_ptr_free(body);
						return lp;
					}
					rest = lp.u.lv;
				}
				else{
					lvp_st lp = lval_prepare(pgen, gex);
					if (!lp.ok){
						list_ptr_free(body);
						return lp;
					}
					list_ptr_push(body, lp.u.lv);
				}
			}
		}
		else{
			if (ex->u.ex->type == EXPR_PREFIX && ex->u.ex->u.prefix.k == KS_PERIOD3){
				lvp_st lp = lval_prepare(pgen, ex->u.ex->u.ex);
				if (!lp.ok){
					list_ptr_free(body);
					return lp;
				}
				rest = lp.u.lv;
			}
			else{
				lvp_st lp = lval_prepare(pgen, ex->u.ex);
				if (!lp.ok){
					list_ptr_free(body);
					return lp;
				}
				list_ptr_push(body, lp.u.lv);
			}
		}
		return lvp_ok(lvr_list(ex->flp, body, rest));
	}
	return lvp_error(ex->flp, format("Invalid assignment"));
}

static void lval_clearTemps(lvr lv, symtbl sym){
	if (lv->type != LVR_VAR && !varloc_isnull(lv->vlc)){
		symtbl_clearTemp(sym, lv->vlc);
		lv->vlc = VARLOC_NULL;
	}
	switch (lv->type){
		case LVR_VAR:
			return;
		case LVR_INDEX:
			symtbl_clearTemp(sym, lv->u.index.obj);
			symtbl_clearTemp(sym, lv->u.index.key);
			return;
		case LVR_SLICE:
			symtbl_clearTemp(sym, lv->u.slice.obj);
			symtbl_clearTemp(sym, lv->u.slice.start);
			symtbl_clearTemp(sym, lv->u.slice.len);
			return;
		case LVR_SLICEINDEX:
			if (!varloc_isnull(lv->u.sliceindex.indexvlc)){
				symtbl_clearTemp(sym, lv->u.sliceindex.indexvlc);
				lv->u.sliceindex.indexvlc = VARLOC_NULL;
			}
			symtbl_clearTemp(sym, lv->u.sliceindex.obj);
			symtbl_clearTemp(sym, lv->u.sliceindex.key);
			symtbl_clearTemp(sym, lv->u.sliceindex.start);
			symtbl_clearTemp(sym, lv->u.sliceindex.len);
			return;
		case LVR_LIST:
			for (int i = 0; i < lv->u.list.body->size; i++)
				lval_clearTemps(lv->u.list.body->ptrs[i], sym);
			if (lv->u.list.rest != NULL)
				lval_clearTemps(lv->u.list.rest, sym);
			return;
	}
}

static void program_varInit(program prg, lvr lv){
	if (lv->type == LVR_VAR)
		op_nil(prg->ops, lv->vlc);
	else if (lv->type == LVR_LIST){
		for (int i = 0; i < lv->u.list.body->size; i++)
			program_varInit(prg, lv->u.list.body->ptrs[i]);
		if (lv->u.list.rest)
			program_varInit(prg, lv->u.list.rest);
	}
	else
		assert(false);
}

static per_st program_evalLval(pgen_st pgen, pem_enum mode, varloc_st intoVlc, lvr lv,
	op_enum mutop, varloc_st valueVlc, bool clearTemps){
	program prg = pgen.prg;
	symtbl sym = pgen.sym;
	// first, perform the assignment of valueVlc into lv
	switch (lv->type){
		case LVR_VAR:
			if (mutop == OP_INVALID)
				op_move(prg->ops, lv->vlc, valueVlc);
			else
				op_binop(prg->ops, mutop, lv->vlc, lv->vlc, valueVlc);
			break;

		case LVR_INDEX: {
			if (mutop == OP_INVALID)
				op_setat(prg->ops, lv->u.index.obj, lv->u.index.key, valueVlc);
			else{
				per_st pe = program_lvalGet(pgen, PLM_CREATE, VARLOC_NULL, lv);
				if (!pe.ok)
					return pe;
				op_binop(prg->ops, mutop, pe.u.vlc, pe.u.vlc, valueVlc);
				op_setat(prg->ops, lv->u.index.obj, lv->u.index.key, pe.u.vlc);
			}
		} break;

		case LVR_SLICE: {
			if (mutop == OP_INVALID)
				op_splice(prg->ops, lv->u.slice.obj, lv->u.slice.start, lv->u.slice.len, valueVlc);
			else{
				per_st pe = program_lvalGet(pgen, PLM_CREATE, VARLOC_NULL, lv);
				if (!pe.ok)
					return pe;
				lvr lv2 = lvr_var(lv->flp, lv->vlc);
				pe = program_evalLval(pgen, PEM_EMPTY, VARLOC_NULL, lv2, mutop, valueVlc, true);
				lvr_free(lv2);
				if (!pe.ok)
					return pe;
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(lv->flp, ts.u.msg);
				varloc_st t = ts.u.vlc;
				op_numint(prg->ops, t, 0);
				op_slice(prg->ops, t, lv->vlc, t, lv->u.slice.len);
				op_splice(prg->ops, lv->u.slice.obj, lv->u.slice.start, lv->u.slice.len, t);
				symtbl_clearTemp(sym, t);
				symtbl_clearTemp(sym, lv->vlc);
				lv->vlc = VARLOC_NULL;
			}
		} break;

		case LVR_SLICEINDEX: {
			if (mutop == OP_INVALID){
				per_st pe = program_lvalGetIndex(pgen, lv);
				if (!pe.ok)
					return pe;
				op_splice(prg->ops, pe.u.vlc, lv->u.sliceindex.start, lv->u.sliceindex.len,
					valueVlc);
				op_setat(prg->ops, lv->u.sliceindex.obj, lv->u.sliceindex.key, pe.u.vlc);
			}
			else{
				per_st pe = program_lvalGet(pgen, PLM_CREATE, VARLOC_NULL, lv);
				if (!pe.ok)
					return pe;
				lvr lv2 = lvr_var(lv->flp, lv->vlc);
				pe = program_evalLval(pgen, PEM_EMPTY, VARLOC_NULL, lv2, mutop, valueVlc, true);
				lvr_free(lv2);
				if (!pe.ok)
					return pe;
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(lv->flp, ts.u.msg);
				varloc_st t = ts.u.vlc;
				op_numint(prg->ops, t, 0);
				op_slice(prg->ops, t, lv->vlc, t, lv->u.sliceindex.len);
				op_splice(prg->ops, lv->u.sliceindex.indexvlc, lv->u.sliceindex.start,
					lv->u.sliceindex.len, t);
				symtbl_clearTemp(sym, t);
				symtbl_clearTemp(sym, lv->u.sliceindex.indexvlc);
				symtbl_clearTemp(sym, lv->vlc);
				lv->u.sliceindex.indexvlc = VARLOC_NULL;
				lv->vlc = VARLOC_NULL;
			}
		} break;

		case LVR_LIST: {
			sta_st ts = symtbl_addTemp(sym);
			if (!ts.ok)
				return per_error(lv->flp, ts.u.msg);
			varloc_st t = ts.u.vlc;

			for (int i = 0; i < lv->u.list.body->size; i++){
				op_numint(prg->ops, t, i);
				op_getat(prg->ops, t, valueVlc, t);
				per_st pe = program_evalLval(pgen, PEM_EMPTY, VARLOC_NULL,
					lv->u.list.body->ptrs[i], mutop, t, false);
				if (!pe.ok)
					return pe;
			}

			if (lv->u.list.rest != NULL){
				ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(lv->flp, ts.u.msg);
				varloc_st t2 = ts.u.vlc;

				op_numint(prg->ops, t, lv->u.list.body->size);
				op_nil(prg->ops, t2);
				op_slice(prg->ops, t, valueVlc, t, t2);
				symtbl_clearTemp(sym, t2);
				per_st pe = program_evalLval(pgen, PEM_EMPTY, VARLOC_NULL, lv->u.list.rest,
					mutop, t, false);
				if (!pe.ok)
					return pe;
			}
			symtbl_clearTemp(sym, t);
		} break;
	}

	// now, see if we need to put the result into anything
	if (mode == PEM_EMPTY){
		if (clearTemps)
			lval_clearTemps(lv, sym);
		return per_ok(VARLOC_NULL);
	}
	else if (mode == PEM_CREATE){
		sta_st ts = symtbl_addTemp(sym);
		if (!ts.ok)
			return per_error(lv->flp, ts.u.msg);
		intoVlc = ts.u.vlc;
	}

	per_st pe = program_lvalGet(pgen, PLM_INTO, intoVlc, lv);
	if (!pe.ok)
		return pe;
	if (clearTemps)
		lval_clearTemps(lv, sym);
	return per_ok(intoVlc);
}

static psr_st program_slice(pgen_st pgen, expr ex){
	varloc_st start;
	if (ex->u.slice.start == NULL){
		sta_st ts = symtbl_addTemp(pgen.sym);
		if (!ts.ok)
			return psr_error(ex->flp, ts.u.msg);
		start = ts.u.vlc;
		op_numint(pgen.prg->ops, start, 0);
	}
	else{
		per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.slice.start);
		if (!pe.ok)
			return psr_error(pe.u.error.flp, pe.u.error.msg);
		start = pe.u.vlc;
	}

	varloc_st len;
	if (ex->u.slice.len == NULL){
		sta_st ts = symtbl_addTemp(pgen.sym);
		if (!ts.ok)
			return psr_error(ex->flp, ts.u.msg);
		len = ts.u.vlc;
		op_nil(pgen.prg->ops, len);
	}
	else{
		per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.slice.len);
		if (!pe.ok)
			return psr_error(pe.u.error.flp, pe.u.error.msg);
		len = pe.u.vlc;
	}

	return psr_ok(start, len);
}

static per_st program_lvalGetIndex(pgen_st pgen, lvr lv){
	// specifically for LVR_SLICEINDEX in order to fill lv.indexvlc
	if (!varloc_isnull(lv->u.sliceindex.indexvlc))
		return per_ok(lv->u.sliceindex.indexvlc);

	sta_st ts = symtbl_addTemp(pgen.sym);
	if (!ts.ok)
		return per_error(lv->flp, ts.u.msg);
	lv->u.sliceindex.indexvlc = ts.u.vlc;

	op_getat(pgen.prg->ops, lv->u.sliceindex.indexvlc, lv->u.sliceindex.obj, lv->u.sliceindex.key);
	return per_ok(lv->u.sliceindex.indexvlc);
}

static per_st program_lvalGet(pgen_st pgen, plm_enum mode, varloc_st intoVlc, lvr lv){
	program prg = pgen.prg;
	if (!varloc_isnull(lv->vlc)){
		if (mode == PLM_CREATE)
			return per_ok(lv->vlc);
		op_move(prg->ops, intoVlc, lv->vlc);
		return per_ok(intoVlc);
	}

	if (mode == PLM_CREATE){
		sta_st ts = symtbl_addTemp(pgen.sym);
		if (!ts.ok)
			return per_error(lv->flp, ts.u.msg);
		intoVlc = lv->vlc = ts.u.vlc;
	}

	switch (lv->type){
		case LVR_VAR:
			assert(false);
			break;

		case LVR_INDEX:
			op_getat(prg->ops, intoVlc, lv->u.index.obj, lv->u.index.key);
			break;

		case LVR_SLICE:
			op_slice(prg->ops, intoVlc, lv->u.slice.obj, lv->u.slice.start, lv->u.slice.len);
			break;

		case LVR_SLICEINDEX: {
			per_st pe = program_lvalGetIndex(pgen, lv);
			if (!pe.ok)
				return pe;
			op_slice(prg->ops, intoVlc, pe.u.vlc, lv->u.sliceindex.start, lv->u.sliceindex.len);
		} break;

		case LVR_LIST: {
			op_list(prg->ops, intoVlc, lv->u.list.body->size);

			for (int i = 0; i < lv->u.list.body->size; i++){
				per_st pe = program_lvalGet(pgen, PLM_CREATE, VARLOC_NULL,
					lv->u.list.body->ptrs[i]);
				if (!pe.ok)
					return pe;
				op_param2(prg->ops, OP_LIST_PUSH, intoVlc, intoVlc, pe.u.vlc);
			}

			if (lv->u.list.rest != NULL){
				per_st pe = program_lvalGet(pgen, PLM_CREATE, VARLOC_NULL, lv->u.list.rest);
				if (!pe.ok)
					return pe;
				op_param2(prg->ops, OP_LIST_APPEND, intoVlc, intoVlc, pe.u.vlc);
			}
		} break;
	}

	return per_ok(intoVlc);
}

static inline bool program_evalCallArgcount(pgen_st pgen, expr params, int *argcount,
	per_st *pe, varloc_st *p){
	// `p` is an array of 255 varloc_st's, which get filled with `argcount` arguments
	// returns false on error, with error inside of `pe`
	*argcount = 0;
	if (params == NULL)
		return true;
	if (params->type == EXPR_GROUP){
		*argcount = params->u.group->size;
		if (*argcount > 254)
			*argcount = 254;
		for (int i = 0; i < params->u.group->size; i++){
			*pe = program_eval(pgen, i < *argcount ? PEM_CREATE : PEM_EMPTY, VARLOC_NULL,
				params->u.group->ptrs[i]);
			if (!pe->ok)
				return false;
			if (i < *argcount)
				p[i] = pe->u.vlc;
		}
	}
	else{
		*argcount = 1;
		*pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, params);
		if (!pe->ok)
			return false;
		p[0] = pe->u.vlc;
	}
	return true;
}

typedef struct {
	pgen_st pgen;
	pem_enum mode;
	varloc_st intoVlc;
	filepos_st flp;
	per_st pe;
} efu_st;

static bool embed_begin(const char *file, efu_st *efu){
	// in order to capture the `sink_scr_write`, we need to set `capture_write`
	efu->pgen.scr->capture_write = list_byte_new();
	return true;
}

static void embed_end(bool success, const char *file, efu_st *efu){
	if (success){
		// convert the data into a string expression, then load it
		list_byte_null(efu->pgen.scr->capture_write);
		expr ex = expr_str(efu->flp, efu->pgen.scr->capture_write);
		efu->pe = program_eval(efu->pgen, efu->mode, efu->intoVlc, ex);
		expr_free(ex);
	}
	else{
		list_byte_free(efu->pgen.scr->capture_write);
		efu->pe = per_error(efu->flp, format("Failed to read file for `embed`: %s", file));
	}
	efu->pgen.scr->capture_write = NULL;
}

typedef struct {
	bool ok;
	union {
		double value;
		char *msg;
	} u;
} pen_st;

static inline pen_st pen_ok(double value){
	return (pen_st){ .ok = true, .u.value = value };
}

static inline pen_st pen_error(char *msg){
	return (pen_st){ .ok = false, .u.msg = msg };
}

static pen_st program_exprToNum(pgen_st pgen, expr ex);
static inline const char *script_getfile(script scr, int file);

static int native_index(program prg, uint64_t hash){
	// search for the hash
	for (int index = 0; index < prg->keyTable->size; index++){
		if (prg->keyTable->vals[index] == hash)
			return index;
	}
	if (prg->keyTable->size >= 0x7FFFFFFF) // using too many native calls?
		return -1;
	int index = prg->keyTable->size;
	list_u64_push(prg->keyTable, hash);
	return index;
}

static per_st program_evalCall(pgen_st pgen, pem_enum mode, varloc_st intoVlc,
	filepos_st flp, nsname nsn, expr params){
	program prg = pgen.prg;
	symtbl sym = pgen.sym;

	if (nsn->type != NSN_CMD_LOCAL && nsn->type != NSN_CMD_NATIVE && nsn->type != NSN_CMD_OPCODE)
		return per_error(flp, format("Invalid call - not a command"));

	// params can be NULL to indicate emptiness
	if (nsn->type == NSN_CMD_OPCODE && nsn->u.cmdOpcode.opcode == OP_PICK){
		if (params == NULL || params->type != EXPR_GROUP ||
			params->u.group->size != 3)
			return per_error(flp, format("Using `pick` requires exactly three arguments"));

		per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, params->u.group->ptrs[0]);
		if (!pe.ok)
			return pe;
		if (mode == PEM_CREATE){
			sta_st ts = symtbl_addTemp(sym);
			if (!ts.ok)
				return per_error(flp, ts.u.msg);
			intoVlc = ts.u.vlc;
		}

		label pickfalse = label_newstr("pickfalse");
		label finish = label_newstr("pickfinish");

		label_jumpfalse(pickfalse, prg->ops, pe.u.vlc);
		symtbl_clearTemp(sym, pe.u.vlc);

		if (mode == PEM_EMPTY)
			pe = program_eval(pgen, PEM_EMPTY, intoVlc, params->u.group->ptrs[1]);
		else
			pe = program_eval(pgen, PEM_INTO, intoVlc, params->u.group->ptrs[1]);
		if (!pe.ok){
			label_free(pickfalse);
			label_free(finish);
			return pe;
		}
		label_jump(finish, prg->ops);

		label_declare(pickfalse, prg->ops);
		if (mode == PEM_EMPTY)
			pe = program_eval(pgen, PEM_EMPTY, intoVlc, params->u.group->ptrs[2]);
		else
			pe = program_eval(pgen, PEM_INTO, intoVlc, params->u.group->ptrs[2]);
		if (!pe.ok){
			label_free(pickfalse);
			label_free(finish);
			return pe;
		}

		label_declare(finish, prg->ops);
		label_free(pickfalse);
		label_free(finish);
		return per_ok(intoVlc);
	}
	else if (nsn->type == NSN_CMD_OPCODE && nsn->u.cmdOpcode.opcode == OP_EMBED){
		expr file = params;
		while (file && file->type == EXPR_PAREN)
			file = file->u.ex;
		if (file == NULL || file->type != EXPR_STR)
			return per_error(flp, format("Expecting constant string for `embed`"));
		char *cwd = NULL;
		efu_st efu = (efu_st){
			.pgen = pgen,
			.mode = mode,
			.intoVlc = intoVlc,
			.flp = flp
		};
		if (pgen.from >= 0)
			cwd = pathjoin(script_getfile(pgen.scr, pgen.from), "..", pgen.scr->posix);
		list_byte fstr = file->u.str;
		list_byte_null(fstr);
		bool res = fileres_read(pgen.scr, false, (const char *)fstr->bytes, cwd,
			(f_fileres_begin_f)embed_begin, (f_fileres_end_f)embed_end, &efu);
		if (cwd)
			mem_free(cwd);
		if (!res)
			return per_error(flp, format("Failed to embed: %s", (const char *)fstr->bytes));
		return efu.pe;
	}
	else if (nsn->type == NSN_CMD_OPCODE && nsn->u.cmdOpcode.opcode == OP_ISNATIVE){
		expr func = params;
		while (func && func->type == EXPR_PAREN)
			func = func->u.ex;
		if (func && func->type == EXPR_NAMES){
			stl_st sl = symtbl_lookup(sym, func->u.names);
			if (!sl.ok)
				return per_error(func->flp, sl.u.msg);
			if (sl.u.nsn->type == NSN_CMD_NATIVE){
				if (mode == PEM_EMPTY || mode == PEM_CREATE){
					sta_st ts = symtbl_addTemp(sym);
					if (!ts.ok)
						return per_error(flp, ts.u.msg);
					intoVlc = ts.u.vlc;
				}
				int index = native_index(prg, sl.u.nsn->u.hash);
				if (index < 0)
					return per_error(flp, format("Too many native commands"));
				op_isnative(prg->ops, intoVlc, index);
				return per_ok(intoVlc);
			}
		}
		return per_error(flp,
			format("Expecting `isnative` to test against a declared native command"));
	}
	else if (nsn->type == NSN_CMD_OPCODE && nsn->u.cmdOpcode.opcode == OP_STR_HASH && params){
		// attempt to str.hash at compile-time if possible
		list_byte str = NULL;
		double seed = 0;
		expr ex = params;
		if (ex->type == EXPR_GROUP && ex->u.group->size == 2){
			expr ex2 = ex->u.group->ptrs[1];
			ex = ex->u.group->ptrs[0];
			while (ex->type == EXPR_PAREN)
				ex = ex->u.ex;
			if (ex->type == EXPR_STR){
				pen_st p = program_exprToNum(pgen, ex2);
				if (p.ok){
					str = ex->u.str;
					seed = p.u.value;
				}
				else
					mem_free(p.u.msg);
			}
		}
		else{
			while (ex->type == EXPR_PAREN)
				ex = ex->u.ex;
			if (ex->type == EXPR_STR)
				str = ex->u.str;
		}
		if (str){
			// we can perform a static hash!
			uint32_t out[4];
			sink_str_hashplain(str->size, str->bytes, (uint32_t)seed, out);
			expr ex = expr_list(flp, expr_group(flp, expr_group(flp, expr_group(flp,
					expr_num(flp, out[0]),
					expr_num(flp, out[1])),
					expr_num(flp, out[2])),
					expr_num(flp, out[3])));
			per_st p = program_eval(pgen, mode, intoVlc, ex);
			expr_free(ex);
			return p;
		}
	}

	if (mode == PEM_EMPTY || mode == PEM_CREATE){
		sta_st ts = symtbl_addTemp(sym);
		if (!ts.ok)
			return per_error(flp, ts.u.msg);
		intoVlc = ts.u.vlc;
	}

	varloc_st p[256];
	int argcount;
	per_st pe;
	if (!program_evalCallArgcount(pgen, params, &argcount, &pe, p))
		return pe;

	program_flp(prg, flp);
	bool oarg = true;
	if (nsn->type == NSN_CMD_LOCAL)
		label_call(nsn->u.cmdLocal.lbl, prg->ops, intoVlc, argcount);
	else if (nsn->type == NSN_CMD_NATIVE){
		int index = native_index(prg, nsn->u.hash);
		if (index < 0)
			return per_error(flp, format("Too many native commands"));
		op_native(prg->ops, intoVlc, index, argcount);
	}
	else{ // NSN_CMD_OPCODE
		if (nsn->u.cmdOpcode.params < 0)
			op_parama(prg->ops, nsn->u.cmdOpcode.opcode, intoVlc, argcount);
		else{
			oarg = false;
			if (nsn->u.cmdOpcode.params > argcount){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(flp, ts.u.msg);
				p[argcount + 0] = p[argcount + 1] = p[argcount + 2] = ts.u.vlc;
				op_nil(prg->ops, p[argcount]);
				argcount++;
			}
			if (nsn->u.cmdOpcode.params == 0)
				op_param0(prg->ops, nsn->u.cmdOpcode.opcode, intoVlc);
			else if (nsn->u.cmdOpcode.params == 1)
				op_param1(prg->ops, nsn->u.cmdOpcode.opcode, intoVlc, p[0]);
			else if (nsn->u.cmdOpcode.params == 2)
				op_param2(prg->ops, nsn->u.cmdOpcode.opcode, intoVlc, p[0], p[1]);
			else // nsn.params == 3
				op_param3(prg->ops, nsn->u.cmdOpcode.opcode, intoVlc, p[0], p[1], p[2]);
		}
	}

	for (int i = 0; i < argcount; i++){
		if (oarg)
			op_arg(prg->ops, p[i]);
		symtbl_clearTemp(sym, p[i]);
	}

	if (mode == PEM_EMPTY){
		symtbl_clearTemp(sym, intoVlc);
		return per_ok(VARLOC_NULL);
	}
	return per_ok(intoVlc);
}

static per_st program_lvalCheckNil(pgen_st pgen, lvr lv, bool jumpFalse, bool inverted, label skip){
	program prg = pgen.prg;
	symtbl sym = pgen.sym;
	switch (lv->type){
		case LVR_VAR:
		case LVR_INDEX: {
			per_st pe = program_lvalGet(pgen, PLM_CREATE, VARLOC_NULL, lv);
			if (!pe.ok)
				return pe;
			if (jumpFalse == !inverted)
				label_jumpfalse(skip, prg->ops, pe.u.vlc);
			else
				label_jumptrue(skip, prg->ops, pe.u.vlc);
			symtbl_clearTemp(sym, pe.u.vlc);
		} break;

		case LVR_SLICE:
		case LVR_SLICEINDEX: {
			varloc_st obj;
			varloc_st start;
			varloc_st len;
			if (lv->type == LVR_SLICE){
				obj = lv->u.slice.obj;
				start = lv->u.slice.start;
				len = lv->u.slice.len;
			}
			else{
				per_st pe = program_lvalGetIndex(pgen, lv);
				if (!pe.ok)
					return pe;
				obj = pe.u.vlc;
				start = lv->u.sliceindex.start;
				len = lv->u.sliceindex.len;
			}

			sta_st ts = symtbl_addTemp(sym);
			if (!ts.ok)
				return per_error(lv->flp, ts.u.msg);
			varloc_st idx = ts.u.vlc;

			ts = symtbl_addTemp(sym);
			if (!ts.ok)
				return per_error(lv->flp, ts.u.msg);
			varloc_st t = ts.u.vlc;

			op_numint(prg->ops, idx, 0);

			label next = label_newstr("condslicenext");

			op_nil(prg->ops, t);
			op_binop(prg->ops, OP_EQU, t, t, len);
			label_jumpfalse(next, prg->ops, t);
			op_unop(prg->ops, OP_SIZE, t, obj);
			op_binop(prg->ops, OP_NUM_SUB, len, t, start);

			label_declare(next, prg->ops);

			op_binop(prg->ops, OP_LT, t, idx, len);

			label keep = label_newstr("condslicekeep");
			label_jumpfalse(inverted ? keep : skip, prg->ops, t);

			op_binop(prg->ops, OP_NUM_ADD, t, idx, start);
			op_getat(prg->ops, t, obj, t);
			if (jumpFalse)
				label_jumptrue(inverted ? skip : keep, prg->ops, t);
			else
				label_jumpfalse(inverted ? skip : keep, prg->ops, t);

			op_inc(prg->ops, idx);
			label_jump(next, prg->ops);
			label_declare(keep, prg->ops);

			symtbl_clearTemp(sym, idx);
			symtbl_clearTemp(sym, t);
			label_free(next);
			label_free(keep);
		} break;

		case LVR_LIST: {
			label keep = label_newstr("condkeep");
			for (int i = 0; i < lv->u.list.body->size; i++){
				program_lvalCheckNil(pgen, lv->u.list.body->ptrs[i], jumpFalse, true,
					inverted ? skip : keep);
			}
			if (lv->u.list.rest != NULL){
				program_lvalCheckNil(pgen, lv->u.list.rest, jumpFalse, true,
					inverted ? skip : keep);
			}
			if (!inverted)
				label_jump(skip, prg->ops);
			label_declare(keep, prg->ops);
			label_free(keep);
		} break;
	}
	return per_ok(VARLOC_NULL);
}

static per_st program_lvalCondAssignPart(pgen_st pgen, lvr lv, bool jumpFalse, varloc_st valueVlc){
	program prg = pgen.prg;
	symtbl sym = pgen.sym;
	switch (lv->type){
		case LVR_VAR:
		case LVR_INDEX: {
			per_st pe = program_lvalGet(pgen, PLM_CREATE, VARLOC_NULL, lv);
			if (!pe.ok)
				return pe;
			label skip = label_newstr("condskippart");
			if (jumpFalse)
				label_jumpfalse(skip, prg->ops, pe.u.vlc);
			else
				label_jumptrue(skip, prg->ops, pe.u.vlc);
			symtbl_clearTemp(sym, pe.u.vlc);
			pe = program_evalLval(pgen, PEM_EMPTY, VARLOC_NULL, lv, OP_INVALID, valueVlc, true);
			if (!pe.ok){
				label_free(skip);
				return pe;
			}
			label_declare(skip, prg->ops);
			label_free(skip);
		} break;

		case LVR_SLICE:
		case LVR_SLICEINDEX: {
			varloc_st obj;
			varloc_st start;
			varloc_st len;
			if (lv->type == LVR_SLICE){
				obj = lv->u.slice.obj;
				start = lv->u.slice.start;
				len = lv->u.slice.len;
			}
			else{
				per_st pe = program_lvalGetIndex(pgen, lv);
				if (!pe.ok)
					return pe;
				obj = pe.u.vlc;
				start = lv->u.sliceindex.start;
				len = lv->u.sliceindex.len;
			}

			sta_st ts = symtbl_addTemp(sym);
			if (!ts.ok)
				return per_error(lv->flp, ts.u.msg);
			varloc_st idx = ts.u.vlc;

			ts = symtbl_addTemp(sym);
			if (!ts.ok)
				return per_error(lv->flp, ts.u.msg);
			varloc_st t = ts.u.vlc;

			ts = symtbl_addTemp(sym);
			if (!ts.ok)
				return per_error(lv->flp, ts.u.msg);
			varloc_st t2 = ts.u.vlc;

			op_numint(prg->ops, idx, 0);

			label next = label_newstr("condpartslicenext");

			op_nil(prg->ops, t);
			op_binop(prg->ops, OP_EQU, t, t, len);
			label_jumpfalse(next, prg->ops, t);
			op_unop(prg->ops, OP_SIZE, t, obj);
			op_binop(prg->ops, OP_NUM_SUB, len, t, start);

			label_declare(next, prg->ops);

			op_binop(prg->ops, OP_LT, t, idx, len);

			label done = label_newstr("condpartslicedone");
			label_jumpfalse(done, prg->ops, t);

			label inc = label_newstr("condpartsliceinc");
			op_binop(prg->ops, OP_NUM_ADD, t, idx, start);
			op_getat(prg->ops, t2, obj, t);
			if (jumpFalse)
				label_jumpfalse(inc, prg->ops, t2);
			else
				label_jumptrue(inc, prg->ops, t2);

			op_getat(prg->ops, t2, valueVlc, idx);
			op_setat(prg->ops, obj, t, t2);

			label_declare(inc, prg->ops);
			op_inc(prg->ops, idx);
			label_jump(next, prg->ops);
			label_declare(done, prg->ops);

			symtbl_clearTemp(sym, idx);
			symtbl_clearTemp(sym, t);
			symtbl_clearTemp(sym, t2);
			label_free(next);
			label_free(done);
			label_free(inc);
		} break;

		case LVR_LIST: {
			sta_st ts = symtbl_addTemp(sym);
			if (!ts.ok)
				return per_error(lv->flp, ts.u.msg);
			varloc_st t = ts.u.vlc;
			for (int i = 0; i < lv->u.list.body->size; i++){
				op_numint(prg->ops, t, i);
				op_getat(prg->ops, t, valueVlc, t);
				per_st pe = program_lvalCondAssignPart(pgen, lv->u.list.body->ptrs[i],
					jumpFalse, t);
				if (!pe.ok)
					return pe;
			}
			if (lv->u.list.rest != NULL){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(lv->flp, ts.u.msg);
				varloc_st t2 = ts.u.vlc;
				op_numint(prg->ops, t, lv->u.list.body->size);
				op_nil(prg->ops, t2);
				op_slice(prg->ops, t, valueVlc, t, t2);
				symtbl_clearTemp(sym, t2);
				per_st pe = program_lvalCondAssignPart(pgen, lv->u.list.rest, jumpFalse, t);
				if (!pe.ok)
					return pe;
			}
			symtbl_clearTemp(sym, t);
		} break;
	}
	return per_ok(VARLOC_NULL);
}

static per_st program_lvalCondAssign(pgen_st pgen, lvr lv, bool jumpFalse, varloc_st valueVlc){
	switch (lv->type){
		case LVR_VAR:
		case LVR_INDEX: {
			per_st pe = program_evalLval(pgen, PEM_EMPTY, VARLOC_NULL, lv, OP_INVALID,
				valueVlc, true);
			if (!pe.ok)
				return pe;
		} break;

		case LVR_SLICE:
		case LVR_SLICEINDEX:
		case LVR_LIST:
			return program_lvalCondAssignPart(pgen, lv, jumpFalse, valueVlc);
	}
	symtbl_clearTemp(pgen.sym, valueVlc);
	return per_ok(VARLOC_NULL);
}

static per_st program_eval(pgen_st pgen, pem_enum mode, varloc_st intoVlc, expr ex){
	program prg = pgen.prg;
	symtbl sym = pgen.sym;
	program_flp(prg, ex->flp);
	switch (ex->type){
		case EXPR_NIL: {
			if (mode == PEM_EMPTY)
				return per_ok(VARLOC_NULL);
			else if (mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}
			op_nil(prg->ops, intoVlc);
			return per_ok(intoVlc);
		} break;

		case EXPR_NUM: {
			if (mode == PEM_EMPTY)
				return per_ok(VARLOC_NULL);
			else if (mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}
			op_num(prg->ops, intoVlc, ex->u.num);
			return per_ok(intoVlc);
		} break;

		case EXPR_STR: {
			if (mode == PEM_EMPTY)
				return per_ok(VARLOC_NULL);
			else if (mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}
			bool found = false;
			int64_t index;
			for (index = 0; index < prg->strTable->size; index++){
				if (list_byte_equ(ex->u.str, prg->strTable->ptrs[index])){
					found = true;
					break;
				}
			}
			if (!found){
				if (index >= 0x7FFFFFFF)
					return per_error(ex->flp, format("Too many string constants"));
				list_ptr_push(prg->strTable, ex->u.str);
				ex->u.str = NULL;
			}
			op_str(prg->ops, intoVlc, index);
			return per_ok(intoVlc);
		} break;

		case EXPR_LIST: {
			if (mode == PEM_EMPTY){
				if (ex->u.ex != NULL)
					return program_eval(pgen, PEM_EMPTY, VARLOC_NULL, ex->u.ex);
				return per_ok(VARLOC_NULL);
			}
			else if (mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}
			if (ex->u.ex != NULL){
				if (ex->u.ex->type == EXPR_GROUP){
					varloc_st ls = intoVlc;
					if (mode == PEM_INTO){
						sta_st ts = symtbl_addTemp(sym);
						if (!ts.ok)
							return per_error(ex->flp, ts.u.msg);
						ls = ts.u.vlc;
					}
					op_list(prg->ops, ls, ex->u.ex->u.group->size);
					for (int i = 0; i < ex->u.ex->u.group->size; i++){
						per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL,
							ex->u.ex->u.group->ptrs[i]);
						if (!pe.ok)
							return pe;
						symtbl_clearTemp(sym, pe.u.vlc);
						op_param2(prg->ops, OP_LIST_PUSH, ls, ls, pe.u.vlc);
					}
					if (mode == PEM_INTO){
						symtbl_clearTemp(sym, ls);
						op_move(prg->ops, intoVlc, ls);
					}
				}
				else{
					per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.ex);
					if (!pe.ok)
						return pe;
					// check for `a = {a}`
					if (intoVlc.frame == pe.u.vlc.frame && intoVlc.index == pe.u.vlc.index){
						sta_st ts = symtbl_addTemp(sym);
						if (!ts.ok)
							return per_error(ex->flp, ts.u.msg);
						symtbl_clearTemp(sym, ts.u.vlc);
						symtbl_clearTemp(sym, pe.u.vlc);
						op_list(prg->ops, ts.u.vlc, 1);
						op_param2(prg->ops, OP_LIST_PUSH, ts.u.vlc, ts.u.vlc, pe.u.vlc);
						op_move(prg->ops, intoVlc, ts.u.vlc);
					}
					else{
						symtbl_clearTemp(sym, pe.u.vlc);
						op_list(prg->ops, intoVlc, 1);
						op_param2(prg->ops, OP_LIST_PUSH, intoVlc, intoVlc, pe.u.vlc);
					}
				}
			}
			else
				op_list(prg->ops, intoVlc, 0);
			return per_ok(intoVlc);
		} break;

		case EXPR_NAMES: {
			stl_st sl = symtbl_lookup(sym, ex->u.names);
			if (!sl.ok)
				return per_error(ex->flp, sl.u.msg);
			switch (sl.u.nsn->type){
				case NSN_VAR: {
					if (mode == PEM_EMPTY)
						return per_ok(VARLOC_NULL);
					varloc_st varVlc = varloc_new(sl.u.nsn->u.var.fr->level, sl.u.nsn->u.var.index);
					if (mode == PEM_CREATE)
						return per_ok(varVlc);
					op_move(prg->ops, intoVlc, varVlc);
					return per_ok(intoVlc);
				} break;

				case NSN_ENUM: {
					if (mode == PEM_EMPTY)
						return per_ok(VARLOC_NULL);
					if (mode == PEM_CREATE){
						sta_st ts = symtbl_addTemp(sym);
						if (!ts.ok)
							return per_error(ex->flp, ts.u.msg);
						intoVlc = ts.u.vlc;
					}
					op_num(prg->ops, intoVlc, sl.u.nsn->u.val);
					return per_ok(intoVlc);
				} break;

				case NSN_CMD_LOCAL:
				case NSN_CMD_NATIVE:
				case NSN_CMD_OPCODE:
					return program_evalCall(pgen, mode, intoVlc, ex->flp, sl.u.nsn, NULL);

				case NSN_NAMESPACE:
					return per_error(ex->flp, format("Invalid expression"));
			}
			assert(false);
		} break;

		case EXPR_PAREN:
			return program_eval(pgen, mode, intoVlc, ex->u.ex);

		case EXPR_GROUP:
			for (int i = 0; true; i++){
				if (i == ex->u.group->size - 1)
					return program_eval(pgen, mode, intoVlc, ex->u.group->ptrs[i]);
				per_st pe = program_eval(pgen, PEM_EMPTY, VARLOC_NULL, ex->u.group->ptrs[i]);
				if (!pe.ok)
					return pe;
			}
			break;

		case EXPR_CAT: {
			if (mode == PEM_EMPTY || mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}
			varloc_st t = VARLOC_NULL;
			int tmax = symtbl_tempAvail(sym) - 128;
			if (tmax < 16)
				tmax = 16;
			if (ex->u.cat->size > tmax){
				tmax--;
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				t = ts.u.vlc;
			}
			varloc_st p[256];
			for (int ci = 0; ci < ex->u.cat->size; ci += tmax){
				int len = ex->u.cat->size - ci;
				if (len > tmax)
					len = tmax;
				for (int i = 0; i < len; i++){
					per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL,
						ex->u.cat->ptrs[ci + i]);
					if (!pe.ok)
						return pe;
					p[i] = pe.u.vlc;
				}
				op_cat(prg->ops, ci > 0 ? t : intoVlc, len);
				for (int i = 0; i < len; i++){
					symtbl_clearTemp(sym, p[i]);
					op_arg(prg->ops, p[i]);
				}
				if (ci > 0){
					op_cat(prg->ops, intoVlc, 2);
					op_arg(prg->ops, intoVlc);
					op_arg(prg->ops, t);
				}
			}
			if (!varloc_isnull(t))
				symtbl_clearTemp(sym, t);
			if (mode == PEM_EMPTY){
				symtbl_clearTemp(sym, intoVlc);
				return per_ok(VARLOC_NULL);
			}
			return per_ok(intoVlc);
		} break;

		case EXPR_PREFIX: {
			op_enum unop = ks_toUnaryOp(ex->u.prefix.k);
			if (unop == OP_INVALID)
				return per_error(ex->flp, format("Invalid unary operator"));
			per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.prefix.ex);
			if (!pe.ok)
				return pe;
			if (mode == PEM_EMPTY || mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}
			op_unop(prg->ops, unop, intoVlc, pe.u.vlc);
			symtbl_clearTemp(sym, pe.u.vlc);
			if (mode == PEM_EMPTY){
				symtbl_clearTemp(sym, intoVlc);
				return per_ok(VARLOC_NULL);
			}
			return per_ok(intoVlc);
		} break;

		case EXPR_INFIX: {
			op_enum mutop = ks_toMutateOp(ex->u.infix.k);
			if (ex->u.infix.k == KS_EQU || ex->u.infix.k == KS_AMP2EQU ||
				ex->u.infix.k == KS_PIPE2EQU || mutop != OP_INVALID){
				lvp_st lp = lval_prepare(pgen, ex->u.infix.left);
				if (!lp.ok)
					return per_error(lp.u.error.flp, lp.u.error.msg);

				if (ex->u.infix.k == KS_AMP2EQU || ex->u.infix.k == KS_PIPE2EQU){
					label skip = label_newstr("condsetskip");

					per_st pe = program_lvalCheckNil(pgen, lp.u.lv, ex->u.infix.k == KS_AMP2EQU,
						false, skip);
					if (!pe.ok){
						lvr_free(lp.u.lv);
						label_free(skip);
						return pe;
					}

					pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.infix.right);
					if (!pe.ok){
						lvr_free(lp.u.lv);
						label_free(skip);
						return pe;
					}

					pe = program_lvalCondAssign(pgen, lp.u.lv, ex->u.infix.k == KS_AMP2EQU,
						pe.u.vlc);
					if (!pe.ok){
						lvr_free(lp.u.lv);
						label_free(skip);
						return pe;
					}

					if (mode == PEM_EMPTY){
						label_declare(skip, prg->ops);
						lval_clearTemps(lp.u.lv, sym);
						lvr_free(lp.u.lv);
						label_free(skip);
						return per_ok(VARLOC_NULL);
					}

					label_declare(skip, prg->ops);

					if (mode == PEM_CREATE){
						sta_st ts = symtbl_addTemp(sym);
						if (!ts.ok){
							lvr_free(lp.u.lv);
							label_free(skip);
							return per_error(ex->flp, ts.u.msg);
						}
						intoVlc = ts.u.vlc;
					}

					per_st ple = program_lvalGet(pgen, PLM_INTO, intoVlc, lp.u.lv);
					if (!ple.ok){
						lvr_free(lp.u.lv);
						label_free(skip);
						return ple;
					}

					lval_clearTemps(lp.u.lv, sym);
					lvr_free(lp.u.lv);
					label_free(skip);
					return per_ok(intoVlc);
				}

				// special handling for basic variable assignment to avoid a temporary
				if (ex->u.infix.k == KS_EQU && lp.u.lv->type == LVR_VAR){
					per_st pe = program_eval(pgen, PEM_INTO, lp.u.lv->vlc, ex->u.infix.right);
					if (!pe.ok){
						lvr_free(lp.u.lv);
						return pe;
					}
					if (mode == PEM_EMPTY){
						lvr_free(lp.u.lv);
						return per_ok(VARLOC_NULL);
					}
					else if (mode == PEM_CREATE){
						sta_st ts = symtbl_addTemp(sym);
						if (!ts.ok){
							lvr_free(lp.u.lv);
							return per_error(ex->flp, ts.u.msg);
						}
						intoVlc = ts.u.vlc;
					}
					op_move(prg->ops, intoVlc, lp.u.lv->vlc);
					lvr_free(lp.u.lv);
					return per_ok(intoVlc);
				}

				per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.infix.right);
				if (!pe.ok){
					lvr_free(lp.u.lv);
					return pe;
				}
				pe = program_evalLval(pgen, mode, intoVlc, lp.u.lv, mutop, pe.u.vlc, true);
				lvr_free(lp.u.lv);
				return pe;
			}

			if (mode == PEM_EMPTY || mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}

			op_enum binop = ks_toBinaryOp(ex->u.infix.k);
			if (binop != OP_INVALID){
				per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.infix.left);
				if (!pe.ok)
					return pe;
				varloc_st left = pe.u.vlc;
				pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.infix.right);
				if (!pe.ok)
					return pe;
				program_flp(prg, ex->flp);
				op_binop(prg->ops, binop, intoVlc, left, pe.u.vlc);
				symtbl_clearTemp(sym, left);
				symtbl_clearTemp(sym, pe.u.vlc);
			}
			else if (ex->u.infix.k == KS_AMP2 || ex->u.infix.k == KS_PIPE2){
				per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.infix.left);
				if (!pe.ok)
					return pe;
				varloc_st left = pe.u.vlc;
				label useleft = label_newstr("useleft");
				if (ex->u.infix.k == KS_AMP2)
					label_jumpfalse(useleft, prg->ops, left);
				else
					label_jumptrue(useleft, prg->ops, left);
				pe = program_eval(pgen, PEM_INTO, intoVlc, ex->u.infix.right);
				if (!pe.ok){
					label_free(useleft);
					return pe;
				}
				label finish = label_newstr("finish");
				label_jump(finish, prg->ops);
				label_declare(useleft, prg->ops);
				op_move(prg->ops, intoVlc, left);
				label_declare(finish, prg->ops);
				symtbl_clearTemp(sym, left);
				label_free(useleft);
				label_free(finish);
			}
			else
				return per_error(ex->flp, format("Invalid operation"));

			if (mode == PEM_EMPTY){
				symtbl_clearTemp(sym, intoVlc);
				return per_ok(VARLOC_NULL);
			}
			return per_ok(intoVlc);
		} break;

		case EXPR_CALL: {
			if (ex->u.call.cmd->type != EXPR_NAMES)
				return per_error(ex->flp, format("Invalid call"));
			stl_st sl = symtbl_lookup(sym, ex->u.call.cmd->u.names);
			if (!sl.ok)
				return per_error(ex->flp, sl.u.msg);
			return program_evalCall(pgen, mode, intoVlc, ex->flp, sl.u.nsn, ex->u.call.params);
		} break;

		case EXPR_INDEX: {
			if (mode == PEM_EMPTY){
				per_st pe = program_eval(pgen, PEM_EMPTY, VARLOC_NULL, ex->u.index.obj);
				if (!pe.ok)
					return pe;
				pe = program_eval(pgen, PEM_EMPTY, VARLOC_NULL, ex->u.index.key);
				if (!pe.ok)
					return pe;
				return per_ok(VARLOC_NULL);
			}

			if (mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}

			per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.index.obj);
			if (!pe.ok)
				return pe;
			varloc_st obj = pe.u.vlc;

			pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.index.key);
			if (!pe.ok)
				return pe;
			varloc_st key = pe.u.vlc;

			op_getat(prg->ops, intoVlc, obj, key);
			symtbl_clearTemp(sym, obj);
			symtbl_clearTemp(sym, key);
			return per_ok(intoVlc);
		} break;

		case EXPR_SLICE: {
			if (mode == PEM_EMPTY || mode == PEM_CREATE){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return per_error(ex->flp, ts.u.msg);
				intoVlc = ts.u.vlc;
			}

			per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.slice.obj);
			if (!pe.ok)
				return pe;
			varloc_st obj = pe.u.vlc;

			psr_st sr = program_slice(pgen, ex);
			if (!sr.ok)
				return per_error(sr.u.error.flp, sr.u.error.msg);

			op_slice(prg->ops, intoVlc, obj, sr.u.ok.start, sr.u.ok.len);
			symtbl_clearTemp(sym, obj);
			symtbl_clearTemp(sym, sr.u.ok.start);
			symtbl_clearTemp(sym, sr.u.ok.len);
			if (mode == PEM_EMPTY){
				symtbl_clearTemp(sym, intoVlc);
				return per_ok(VARLOC_NULL);
			}
			return per_ok(intoVlc);
		} break;
	}
	assert(false);
	return per_ok(VARLOC_NULL);
}

static pen_st program_exprToNum(pgen_st pgen, expr ex){
	if (ex->type == EXPR_NUM)
		return pen_ok(ex->u.num);
	else if (ex->type == EXPR_NAMES){
		stl_st sl = symtbl_lookup(pgen.sym, ex->u.names);
		if (!sl.ok)
			return pen_error(sl.u.msg);
		if (sl.u.nsn->type == NSN_ENUM)
			return pen_ok(sl.u.nsn->u.val);
	}
	else if (ex->type == EXPR_PAREN)
		return program_exprToNum(pgen, ex->u.ex);
	else if (ex->type == EXPR_PREFIX){
		pen_st n = program_exprToNum(pgen, ex->u.prefix.ex);
		if (n.ok){
			op_enum k = ks_toUnaryOp(ex->u.prefix.k);
			if (k == OP_TONUM)
				return pen_ok(n.u.value);
			else if (k == OP_NUM_NEG)
				return pen_ok(-n.u.value);
		}
	}
	else if (ex->type == EXPR_INFIX){
		pen_st n1 = program_exprToNum(pgen, ex->u.infix.left);
		if (!n1.ok)
			return n1;
		pen_st n2 = program_exprToNum(pgen, ex->u.infix.right);
		if (!n2.ok)
			return n2;
		op_enum binop = ks_toBinaryOp(ex->u.infix.k);
		if      (binop == OP_NUM_ADD) return pen_ok(n1.u.value + n2.u.value);
		else if (binop == OP_NUM_SUB) return pen_ok(n1.u.value - n2.u.value);
		else if (binop == OP_NUM_MOD) return pen_ok(fmod(n1.u.value, n2.u.value));
		else if (binop == OP_NUM_MUL) return pen_ok(n1.u.value * n2.u.value);
		else if (binop == OP_NUM_DIV) return pen_ok(n1.u.value / n2.u.value);
		else if (binop == OP_NUM_POW) return pen_ok(pow(n1.u.value, n2.u.value));
	}
	return pen_error(format("Enums must be a constant number"));
}

typedef struct {
	void *state;
	sink_free_f f_free;
} pgst_st, *pgst;

static inline void pgst_free(pgst pgs){
	if (pgs->f_free)
		pgs->f_free(pgs->state);
	mem_free(pgs);
}

static inline pgst pgst_new(void *state, sink_free_f f_free){
	pgst pgs = mem_alloc(sizeof(pgst_st));
	pgs->state = state;
	pgs->f_free = f_free;
	return pgs;
}

typedef enum {
	PGR_OK,
	PGR_PUSH,
	PGR_POP,
	PGR_ERROR,
	PGR_FORVARS
} pgr_enum;

typedef struct {
	pgr_enum type;
	union {
		struct {
			pgst pgs;
		} push;
		struct {
			filepos_st flp;
			char *msg;
		} error;
		struct {
			varloc_st val_vlc;
			varloc_st idx_vlc;
		} forvars;
	} u;
} pgr_st;

static inline pgr_st pgr_ok(){
	return (pgr_st){ .type = PGR_OK };
}

static inline pgr_st pgr_push(void *state, sink_free_f f_free){
	return (pgr_st){ .type = PGR_PUSH, .u.push.pgs = pgst_new(state, f_free) };
}

static inline pgr_st pgr_pop(){
	return (pgr_st){ .type = PGR_POP };
}

static inline pgr_st pgr_error(filepos_st flp, char *msg){
	return (pgr_st){ .type = PGR_ERROR, .u.error.flp = flp, .u.error.msg = msg };
}

static inline pgr_st pgr_forvars(varloc_st val_vlc, varloc_st idx_vlc){
	return (pgr_st){ .type = PGR_FORVARS, .u.forvars.val_vlc = val_vlc,
		.u.forvars.idx_vlc = idx_vlc };
}

typedef struct {
	label top;
	label cond;
	label finish;
} pgs_dowhile_st, *pgs_dowhile;

static inline void pgs_dowhile_free(pgs_dowhile pst){
	if (pst->top)
		label_free(pst->top);
	label_free(pst->cond);
	label_free(pst->finish);
	mem_free(pst);
}

static inline pgs_dowhile pgs_dowhile_new(label top, label cond, label finish){
	pgs_dowhile pst = mem_alloc(sizeof(pgs_dowhile_st));
	pst->top = top;
	pst->cond = cond;
	pst->finish = finish;
	return pst;
}

typedef struct {
	label top;
	label inc;
	label finish;
	varloc_st t1;
	varloc_st t2;
	varloc_st t3;
	varloc_st t4;
	varloc_st val_vlc;
	varloc_st idx_vlc;
} pgs_for_st, *pgs_for;

static inline void pgs_for_free(pgs_for pst){
	label_free(pst->top);
	label_free(pst->inc);
	label_free(pst->finish);
	mem_free(pst);
}

static inline pgs_for pgs_for_new(varloc_st t1, varloc_st t2, varloc_st t3, varloc_st t4,
	varloc_st val_vlc, varloc_st idx_vlc, label top, label inc, label finish){
	pgs_for pst = mem_alloc(sizeof(pgs_for_st));
	pst->t1 = t1;
	pst->t2 = t2;
	pst->t3 = t3;
	pst->t4 = t4;
	pst->val_vlc = val_vlc;
	pst->idx_vlc = idx_vlc;
	pst->top = top;
	pst->inc = inc;
	pst->finish = finish;
	return pst;
}

typedef struct {
	label lcont;
	label lbrk;
} pgs_loop_st, *pgs_loop;

static inline void pgs_loop_free(pgs_loop pst){
	label_free(pst->lcont);
	label_free(pst->lbrk);
	mem_free(pst);
}

static inline pgs_loop pgs_loop_new(label lcont, label lbrk){
	pgs_loop pst = mem_alloc(sizeof(pgs_loop_st));
	pst->lcont = lcont;
	pst->lbrk = lbrk;
	return pst;
}

typedef struct {
	label nextcond;
	label ifdone;
} pgs_if_st, *pgs_if;

static inline void pgs_if_free(pgs_if pst){
	if (pst->nextcond)
		label_free(pst->nextcond);
	label_free(pst->ifdone);
	mem_free(pst);
}

static inline pgs_if pgs_if_new(label nextcond, label ifdone){
	pgs_if pst = mem_alloc(sizeof(pgs_if_st));
	pst->nextcond = nextcond;
	pst->ifdone = ifdone;
	return pst;
}

typedef struct {
	varloc_st vlc;
	char *err;
} pfvs_res_st;

static inline pfvs_res_st program_forVarsSingle(symtbl sym, bool forVar, list_ptr names){
	if (names == NULL || forVar){
		sta_st ts = names == NULL ? symtbl_addTemp(sym) : symtbl_addVar(sym, names, -1);
		if (!ts.ok)
			return (pfvs_res_st){ .vlc = VARLOC_NULL, .err = ts.u.msg };
		return (pfvs_res_st){ .vlc = ts.u.vlc, .err = NULL };
	}
	else{
		stl_st sl = symtbl_lookup(sym, names);
		if (!sl.ok)
			return (pfvs_res_st){ .vlc = VARLOC_NULL, .err = sl.u.msg };
		if (sl.u.nsn->type != NSN_VAR){
			return (pfvs_res_st){
				.vlc = VARLOC_NULL,
				.err = format("Cannot use non-variable in for loop")
			};
		}
		return (pfvs_res_st){
			.vlc = varloc_new(sl.u.nsn->u.var.fr->level, sl.u.nsn->u.var.index),
			.err = NULL
		};
	}
}

static pgr_st program_forVars(symtbl sym, ast stmt){
	pfvs_res_st pf1 = { .vlc = VARLOC_NULL };
	if (stmt->u.for1.names1 != NULL){
		pf1 = program_forVarsSingle(sym, stmt->u.for1.forVar, stmt->u.for1.names1);
		if (pf1.err)
			return pgr_error(stmt->flp, pf1.err);
	}
	pfvs_res_st pf2 = program_forVarsSingle(sym, stmt->u.for1.forVar, stmt->u.for1.names2);
	if (pf2.err)
		return pgr_error(stmt->flp, pf2.err);
	return pgr_forvars(pf1.vlc, pf2.vlc);
}

static pgr_st program_genForRange(pgen_st pgen, ast stmt, varloc_st p1, varloc_st p2, varloc_st p3){
	program prg = pgen.prg;
	symtbl sym = pgen.sym;
	bool zerostart = false;
	if (varloc_isnull(p2)){
		zerostart = true;
		p2 = p1;
		sta_st ts = symtbl_addTemp(sym);
		if (!ts.ok)
			return pgr_error(stmt->flp, ts.u.msg);
		p1 = ts.u.vlc;
		op_numint(prg->ops, p1, 0);
	}

	symtbl_pushScope(sym);
	pgr_st pgi = program_forVars(sym, stmt);
	if (pgi.type != PGR_FORVARS)
		return pgi;
	varloc_st val_vlc = pgi.u.forvars.val_vlc;
	varloc_st idx_vlc = pgi.u.forvars.idx_vlc;

	// clear the index
	op_numint(prg->ops, idx_vlc, 0);

	// calculate count
	if (!zerostart)
		op_binop(prg->ops, OP_NUM_SUB, p2, p2, p1);
	if (!varloc_isnull(p3))
		op_binop(prg->ops, OP_NUM_DIV, p2, p2, p3);

	label top    = label_newstr("forR_top");
	label inc    = label_newstr("forR_inc");
	label finish = label_newstr("forR_finish");

	sta_st ts = symtbl_addTemp(sym);
	if (!ts.ok){
		label_free(top);
		label_free(inc);
		label_free(finish);
		return pgr_error(stmt->flp, ts.u.msg);
	}
	varloc_st t = ts.u.vlc;

	label_declare(top, prg->ops);

	op_binop(prg->ops, OP_LT, t, idx_vlc, p2);
	label_jumpfalse(finish, prg->ops, t);

	if (!varloc_isnull(val_vlc)){
		if (varloc_isnull(p3)){
			if (!zerostart)
				op_binop(prg->ops, OP_NUM_ADD, val_vlc, p1, idx_vlc);
			else
				op_move(prg->ops, val_vlc, idx_vlc);
		}
		else{
			op_binop(prg->ops, OP_NUM_MUL, val_vlc, idx_vlc, p3);
			if (!zerostart)
				op_binop(prg->ops, OP_NUM_ADD, val_vlc, p1, val_vlc);
		}
	}

	sym->sc->lblBreak = finish;
	sym->sc->lblContinue = inc;

	return pgr_push(pgs_for_new(p1, p2, p3, t, val_vlc, idx_vlc, top, inc, finish),
		(sink_free_f)pgs_for_free);
}

static pgr_st program_genForGeneric(pgen_st pgen, ast stmt){
	program prg = pgen.prg;
	symtbl sym = pgen.sym;
	per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, stmt->u.for1.ex);
	if (!pe.ok)
		return pgr_error(pe.u.error.flp, pe.u.error.msg);

	symtbl_pushScope(sym);

	varloc_st exp_vlc = pe.u.vlc;

	pgr_st pgi = program_forVars(sym, stmt);
	if (pgi.type != PGR_FORVARS)
		return pgi;
	varloc_st val_vlc = pgi.u.forvars.val_vlc;
	varloc_st idx_vlc = pgi.u.forvars.idx_vlc;

	// clear the index
	op_numint(prg->ops, idx_vlc, 0);

	label top    = label_newstr("forG_top");
	label inc    = label_newstr("forG_inc");
	label finish = label_newstr("forG_finish");

	sta_st ts = symtbl_addTemp(sym);
	if (!ts.ok){
		label_free(top);
		label_free(inc);
		label_free(finish);
		return pgr_error(stmt->flp, ts.u.msg);
	}
	varloc_st t = ts.u.vlc;

	label_declare(top, prg->ops);

	op_unop(prg->ops, OP_SIZE, t, exp_vlc);
	op_binop(prg->ops, OP_LT, t, idx_vlc, t);
	label_jumpfalse(finish, prg->ops, t);

	if (!varloc_isnull(val_vlc))
		op_getat(prg->ops, val_vlc, exp_vlc, idx_vlc);
	sym->sc->lblBreak = finish;
	sym->sc->lblContinue = inc;

	return pgr_push(
		pgs_for_new(t, exp_vlc, VARLOC_NULL, VARLOC_NULL, val_vlc, idx_vlc, top, inc, finish),
		(sink_free_f)pgs_for_free);
}

static inline pgr_st program_gen(pgen_st pgen, ast stmt, void *state, bool sayexpr){
	program prg = pgen.prg;
	symtbl sym = pgen.sym;
	program_flp(prg, stmt->flp);
	switch (stmt->type){
		case AST_BREAK: {
			if (sym->sc->lblBreak == NULL)
				return pgr_error(stmt->flp, format("Invalid `break`"));
			label_jump(sym->sc->lblBreak, prg->ops);
			return pgr_ok();
		} break;

		case AST_CONTINUE: {
			if (sym->sc->lblContinue == NULL)
				return pgr_error(stmt->flp, format("Invalid `continue`"));
			label_jump(sym->sc->lblContinue, prg->ops);
			return pgr_ok();
		} break;

		case AST_DECLARE: {
			decl dc = stmt->u.declare;
			if (dc->local){
				label lbl = label_newstr("def");
				list_ptr_push(sym->fr->lbls, lbl);
				char *smsg = symtbl_addCmdLocal(sym, dc->names, lbl);
				if (smsg)
					return pgr_error(dc->flp, smsg);
				scope_addDeclare(sym->sc, stmt->flp, dc->names, lbl);
			}
			else{ // native
				char *smsg = symtbl_addCmdNative(sym, dc->names,
					native_hash(dc->key->size, dc->key->bytes));
				if (smsg)
					return pgr_error(dc->flp, smsg);
			}
			return pgr_ok();
		} break;

		case AST_DEF1: {
			nl_st n = namespace_lookupImmediate(sym->sc->ns, stmt->u.def1.names);
			label lbl;
			if (n.found && n.nsn->type == NSN_CMD_LOCAL){
				lbl = n.nsn->u.cmdLocal.lbl;
				if (lbl->pos < 0)
					scope_removeDeclare(sym->sc, lbl);
				else if (!sym->repl){ // if already defined, error
					list_byte b = stmt->u.def1.names->ptrs[0];
					char *join = format("Cannot redefine \"%.*s", b->size, b->bytes);
					for (int i = 1; i < stmt->u.def1.names->size; i++){
						b = stmt->u.def1.names->ptrs[i];
						char *join2 = format("%s.%.*s", join, b->size, b->bytes);
						mem_free(join);
						join = join2;
					}
					char *join2 = format("%s\"", join);
					mem_free(join);
					return pgr_error(stmt->u.def1.flpN, join2);
				}
			}
			else{
				lbl = label_newstr("def");
				list_ptr_push(sym->fr->lbls, lbl);
				char *smsg = symtbl_addCmdLocal(sym, stmt->u.def1.names, lbl);
				if (smsg)
					return pgr_error(stmt->u.def1.flpN, smsg);
			}

			int level = sym->fr->level + 1;
			if (level > 255)
				return pgr_error(stmt->flp, format("Too many nested commands"));
			int rest = 0xFF;
			int lvs = stmt->u.def1.lvalues->size;
			if (lvs > 255)
				return pgr_error(stmt->flp, format("Too many parameters"));
			if (lvs > 0){
				expr last_ex = stmt->u.def1.lvalues->ptrs[lvs - 1];
				// is the last expression a `...rest`?
				if (last_ex->type == EXPR_PREFIX && last_ex->u.prefix.k == KS_PERIOD3)
					rest = lvs - 1;
			}

			label skip = label_newstr("after_def");
			label_jump(skip, prg->ops);

			label_declare(lbl, prg->ops);
			symtbl_pushFrame(sym);

			program_cmdhint(prg, stmt->u.def1.names);
			op_cmdhead(prg->ops, level, rest);

			// reserve our argument registers as explicit registers 0 to lvs-1
			symtbl_reserveVars(sym, lvs);

			// initialize our arguments as needed
			for (int i = 0; i < lvs; i++){
				expr ex = stmt->u.def1.lvalues->ptrs[i];
				if (ex->type == EXPR_INFIX){
					// the argument is the i-th register
					varloc_st arg = varloc_new(level, i);

					// check for initialization -- must happen before the symbols are added so that
					// `def a x = x` binds the seconds `x` to the outer scope
					if (ex->u.infix.right != NULL){
						label argset = label_newstr("argset");
						label_jumptrue(argset, prg->ops, arg);
						per_st pr = program_eval(pgen, PEM_INTO, arg, ex->u.infix.right);
						if (!pr.ok){
							label_free(skip);
							label_free(argset);
							return pgr_error(pr.u.error.flp, pr.u.error.msg);
						}
						label_declare(argset, prg->ops);
						label_free(argset);
					}

					// now we can add the param symbols
					lvp_st lr = lval_addVars(sym, ex->u.infix.left, i);
					if (!lr.ok){
						label_free(skip);
						return pgr_error(lr.u.error.flp, lr.u.error.msg);
					}

					// move argument into lval(s)
					per_st pe = program_evalLval(pgen, PEM_EMPTY, VARLOC_NULL, lr.u.lv,
						OP_INVALID, arg, true);
					lvr_free(lr.u.lv);
					if (!pe.ok){
						label_free(skip);
						return pgr_error(pe.u.error.flp, pe.u.error.msg);
					}
				}
				else if (i == lvs - 1 && ex->type == EXPR_PREFIX && ex->u.prefix.k == KS_PERIOD3){
					lvp_st lr = lval_addVars(sym, ex->u.prefix.ex, i);
					if (!lr.ok){
						label_free(skip);
						return pgr_error(lr.u.error.flp, lr.u.error.msg);
					}
					assert(lr.u.lv->type == LVR_VAR);
					lvr_free(lr.u.lv);
				}
				else
					assert(false);
			}
			return pgr_push(skip, (sink_free_f)label_free);
		} break;

		case AST_DEF2: {
			program_cmdhint(prg, NULL);
			op_cmdtail(prg->ops);
			char *err = symtbl_popFrame(sym);
			if (err)
				return pgr_error(stmt->flp, err);
			label skip = state;
			label_declare(skip, prg->ops);
			return pgr_pop();
		} break;

		case AST_DOWHILE1: {
			label top    = label_newstr("dowhile_top");
			label cond   = label_newstr("dowhile_cond");
			label finish = label_newstr("dowhile_finish");

			symtbl_pushScope(sym);
			sym->sc->lblBreak = finish;
			sym->sc->lblContinue = cond;

			label_declare(top, prg->ops);
			return pgr_push(pgs_dowhile_new(top, cond, finish), (sink_free_f)pgs_dowhile_free);
		} break;

		case AST_DOWHILE2: {
			pgs_dowhile pst = state;

			label_declare(pst->cond, prg->ops);
			if (stmt->u.cond){
				// do while end
				per_st pe = program_eval(pgen, PEM_CREATE, VARLOC_NULL, stmt->u.cond);
				if (!pe.ok)
					return pgr_error(pe.u.error.flp, pe.u.error.msg);
				label_jumpfalse(pst->finish, prg->ops, pe.u.vlc);
				symtbl_clearTemp(sym, pe.u.vlc);
				sym->sc->lblContinue = pst->top;
				return pgr_ok();
			}
			else{
				// do end
				label_free(pst->top);
				pst->top = NULL;
				return pgr_ok();
			}
		} break;

		case AST_DOWHILE3: {
			pgs_dowhile pst = state;

			if (pst->top)
				label_jump(pst->top, prg->ops);
			label_declare(pst->finish, prg->ops);
			char *err = symtbl_popScope(sym);
			if (err)
				return pgr_error(stmt->flp, err);
			return pgr_pop();
		} break;

		case AST_ENUM: {
			double last_val = -1;
			for (int i = 0; i < stmt->u.lvalues->size; i++){
				expr ex = stmt->u.lvalues->ptrs[i];
				assert(ex->type == EXPR_INFIX);
				double v = last_val + 1;
				if (ex->u.infix.right != NULL){
					pen_st n = program_exprToNum(pgen, ex->u.infix.right);
					if (!n.ok)
						return pgr_error(stmt->flp, n.u.msg);
					v = n.u.value;
				}
				if (ex->u.infix.left->type != EXPR_NAMES){
					return pgr_error(stmt->flp,
						format("Enum name must only consist of identifiers"));
				}
				last_val = v;
				char *smsg = symtbl_addEnum(sym, ex->u.infix.left->u.names, v);
				if (smsg)
					return pgr_error(stmt->flp, smsg);
			}
			return pgr_ok();
		} break;

		case AST_FOR1: {
			if (stmt->u.for1.ex->type == EXPR_CALL){
				expr c = stmt->u.for1.ex;
				if (c->u.call.cmd->type == EXPR_NAMES){
					expr n = c->u.call.cmd;
					stl_st sl = symtbl_lookup(sym, n->u.names);
					if (!sl.ok)
						return pgr_error(stmt->flp, sl.u.msg);
					nsname nsn = sl.u.nsn;
					if (nsn->type == NSN_CMD_OPCODE && nsn->u.cmdOpcode.opcode == OP_RANGE){
						expr p = c->u.call.params;
						varloc_st rp[3] = { VARLOC_NULL, VARLOC_NULL, VARLOC_NULL };
						if (p->type != EXPR_GROUP){
							sta_st ts = symtbl_addTemp(sym);
							if (!ts.ok)
								return pgr_error(stmt->flp, ts.u.msg);
							rp[0] = ts.u.vlc;
							per_st pe = program_eval(pgen, PEM_INTO, rp[0], p);
							if (!pe.ok)
								return pgr_error(pe.u.error.flp, pe.u.error.msg);
						}
						else{
							for (int i = 0; i < p->u.group->size; i++){
								if (i < 3){
									sta_st ts = symtbl_addTemp(sym);
									if (!ts.ok)
										return pgr_error(stmt->flp, ts.u.msg);
									rp[i] = ts.u.vlc;
								}
								per_st pe = program_eval(pgen,
									i < 3 ? PEM_INTO : PEM_EMPTY,
									i < 3 ? rp[i] : VARLOC_NULL,
									p->u.group->ptrs[i]);
								if (!pe.ok)
									return pgr_error(pe.u.error.flp, pe.u.error.msg);
							}
						}
						return program_genForRange(pgen, stmt, rp[0], rp[1], rp[2]);
					}
				}
			}
			return program_genForGeneric(pgen, stmt);
		} break;

		case AST_FOR2: {
			pgs_for pst = state;

			label_declare(pst->inc, prg->ops);
			op_inc(prg->ops, pst->idx_vlc);
			label_jump(pst->top, prg->ops);

			label_declare(pst->finish, prg->ops);
			symtbl_clearTemp(sym, pst->t1);
			symtbl_clearTemp(sym, pst->t2);
			if (!varloc_isnull(pst->t3))
				symtbl_clearTemp(sym, pst->t3);
			if (!varloc_isnull(pst->t4))
				symtbl_clearTemp(sym, pst->t4);
			if (!varloc_isnull(pst->val_vlc))
				symtbl_clearTemp(sym, pst->val_vlc);
			symtbl_clearTemp(sym, pst->idx_vlc);
			char *err = symtbl_popScope(sym);
			if (err)
				return pgr_error(stmt->flp, err);
			return pgr_pop();
		} break;

		case AST_LOOP1: {
			symtbl_pushScope(sym);
			label lcont = label_newstr("loop_continue");
			label lbrk = label_newstr("loop_break");
			sym->sc->lblContinue = lcont;
			sym->sc->lblBreak = lbrk;
			label_declare(lcont, prg->ops);
			return pgr_push(pgs_loop_new(lcont, lbrk), (sink_free_f)pgs_loop_free);
		} break;

		case AST_LOOP2: {
			pgs_loop pst = state;

			label_jump(pst->lcont, prg->ops);
			label_declare(pst->lbrk, prg->ops);
			char *err = symtbl_popScope(sym);
			if (err)
				return pgr_error(stmt->flp, err);
			return pgr_pop();
		} break;

		case AST_GOTO: {
			for (int i = 0; i < sym->fr->lbls->size; i++){
				label lbl = sym->fr->lbls->ptrs[i];
				if (lbl->name && list_byte_equ(lbl->name, stmt->u.ident)){
					label_jump(lbl, prg->ops);
					return pgr_ok();
				}
			}
			// label doesn't exist yet, so we'll need to create it
			label lbl = label_new(stmt->u.ident);
			stmt->u.ident = NULL;
			label_jump(lbl, prg->ops);
			list_ptr_push(sym->fr->lbls, lbl);
			return pgr_ok();
		} break;

		case AST_IF1: {
			return pgr_push(pgs_if_new(NULL, label_newstr("ifdone")), (sink_free_f)pgs_if_free);
		} break;

		case AST_IF2: {
			pgs_if pst = state;

			if (pst->nextcond){
				char *err = symtbl_popScope(sym);
				if (err)
					return pgr_error(stmt->flp, err);
				label_jump(pst->ifdone, prg->ops);

				label_declare(pst->nextcond, prg->ops);
				label_free(pst->nextcond);
			}
			pst->nextcond = label_newstr("nextcond");
			per_st pr = program_eval(pgen, PEM_CREATE, VARLOC_NULL, stmt->u.cond);
			if (!pr.ok)
				return pgr_error(pr.u.error.flp, pr.u.error.msg);

			label_jumpfalse(pst->nextcond, prg->ops, pr.u.vlc);
			symtbl_clearTemp(sym, pr.u.vlc);

			symtbl_pushScope(sym);
			return pgr_ok();
		} break;

		case AST_IF3: {
			pgs_if pst = state;

			char *err = symtbl_popScope(sym);
			if (err)
				return pgr_error(stmt->flp, err);
			label_jump(pst->ifdone, prg->ops);

			label_declare(pst->nextcond, prg->ops);
			symtbl_pushScope(sym);
			return pgr_ok();
		} break;

		case AST_IF4: {
			pgs_if pst = state;

			char *err = symtbl_popScope(sym);
			if (err)
				return pgr_error(stmt->flp, err);
			label_declare(pst->ifdone, prg->ops);
			return pgr_pop();
		} break;

		case AST_INCLUDE: {
			assert(false);
		} break;

		case AST_NAMESPACE1: {
			char *smsg = symtbl_pushNamespace(sym, stmt->u.names);
			if (smsg)
				return pgr_error(stmt->flp, smsg);
			return pgr_push(NULL, NULL);
		} break;

		case AST_NAMESPACE2: {
			symtbl_popNamespace(sym);
			return pgr_pop();
		} break;

		case AST_RETURN: {
			nsname nsn = NULL;
			expr params = NULL;
			expr ex = stmt->u.ex;

			// check for tail call
			if (ex->type == EXPR_CALL){
				if (ex->u.call.cmd->type != EXPR_NAMES)
					return pgr_error(ex->flp, format("Invalid call"));
				stl_st sl = symtbl_lookup(sym, ex->u.call.cmd->u.names);
				if (!sl.ok)
					return pgr_error(ex->flp, sl.u.msg);
				nsn = sl.u.nsn;
				params = ex->u.call.params;
			}
			else if (ex->type == EXPR_NAMES){
				stl_st sl = symtbl_lookup(sym, ex->u.names);
				if (!sl.ok)
					return pgr_error(ex->flp, sl.u.msg);
				nsn = sl.u.nsn;
			}

			// can only tail call local commands at the same lexical level
			if (nsn && nsn->type == NSN_CMD_LOCAL &&
				nsn->u.cmdLocal.fr->level + 1 == sym->fr->level){
				int argcount;
				per_st pe;
				varloc_st p[256];
				if (!program_evalCallArgcount(pgen, params, &argcount, &pe, p))
					return pgr_error(pe.u.error.flp, pe.u.error.msg);
				label_returntail(nsn->u.cmdLocal.lbl, prg->ops, argcount);
				for (int i = 0; i < argcount; i++){
					op_arg(prg->ops, p[i]);
					symtbl_clearTemp(sym, p[i]);
				}
				return pgr_ok();
			}

			per_st pr = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex);
			if (!pr.ok)
				return pgr_error(pr.u.error.flp, pr.u.error.msg);
			symtbl_clearTemp(sym, pr.u.vlc);
			op_return(prg->ops, pr.u.vlc);
			return pgr_ok();
		} break;

		case AST_USING: {
			stl_st sl = symtbl_lookupfast(sym, stmt->u.names);
			namespace ns;
			if (!sl.ok){ // not found, so create it
				// don't have to free the error message because lookupfast doesn't create one
				sfn_st sf = symtbl_findNamespace(sym, stmt->u.names, stmt->u.names->size);
				if (!sf.ok)
					return pgr_error(stmt->flp, sf.u.msg);
				ns = sf.u.ns;
			}
			else{
				if (sl.u.nsn->type != NSN_NAMESPACE)
					return pgr_error(stmt->flp, format("Expecting namespace"));
				ns = sl.u.nsn->u.ns;
			}
			if (!list_ptr_has(sym->sc->ns->usings, ns))
				list_ptr_push(sym->sc->ns->usings, ns);
			return pgr_ok();
		} break;

		case AST_VAR: {
			for (int i = 0; i < stmt->u.lvalues->size; i++){
				expr ex = stmt->u.lvalues->ptrs[i];
				assert(ex->type == EXPR_INFIX);
				per_st pr;
				if (ex->u.infix.right != NULL){
					pr = program_eval(pgen, PEM_CREATE, VARLOC_NULL, ex->u.infix.right);
					if (!pr.ok)
						return pgr_error(pr.u.error.flp, pr.u.error.msg);
				}
				lvp_st lr = lval_addVars(sym, ex->u.infix.left, -1);
				if (!lr.ok)
					return pgr_error(lr.u.error.flp, lr.u.error.msg);
				if (ex->u.infix.right != NULL){
					per_st pe = program_evalLval(pgen, PEM_EMPTY, VARLOC_NULL, lr.u.lv,
						OP_INVALID, pr.u.vlc, true);
					lvr_free(lr.u.lv);
					if (!pe.ok)
						return pgr_error(pe.u.error.flp, pe.u.error.msg);
					symtbl_clearTemp(sym, pr.u.vlc);
				}
				else{
					program_varInit(prg, lr.u.lv);
					lvr_free(lr.u.lv);
				}
			}
			return pgr_ok();
		} break;

		case AST_EVAL: {
			per_st pr = program_eval(pgen, sayexpr ? PEM_CREATE : PEM_EMPTY, VARLOC_NULL,
				stmt->u.ex);
			if (!pr.ok)
				return pgr_error(pr.u.error.flp, pr.u.error.msg);
			if (sayexpr){
				sta_st ts = symtbl_addTemp(sym);
				if (!ts.ok)
					return pgr_error(stmt->flp, ts.u.msg);
				op_parama(prg->ops, OP_SAY, ts.u.vlc, 1);
				op_arg(prg->ops, pr.u.vlc);
				symtbl_clearTemp(sym, pr.u.vlc);
				symtbl_clearTemp(sym, ts.u.vlc);
			}
			return pgr_ok();
		} break;

		case AST_LABEL: {
			label lbl = NULL;
			bool found = false;
			for (int i = 0; i < sym->fr->lbls->size; i++){
				lbl = sym->fr->lbls->ptrs[i];
				if (lbl->name && list_byte_equ(lbl->name, stmt->u.ident)){
					if (lbl->pos >= 0){
						return pgr_error(stmt->flp, format("Cannot redeclare label \"%.*s\"",
							stmt->u.ident->size, stmt->u.ident->bytes));
					}
					found = true;
					break;
				}
			}
			if (!found){
				lbl = label_new(stmt->u.ident);
				stmt->u.ident = NULL;
				list_ptr_push(sym->fr->lbls, lbl);
			}
			label_declare(lbl, prg->ops);
			return pgr_ok();
		} break;
	}
	assert(false);
	return pgr_ok();
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//
// runtime
//
////////////////////////////////////////////////////////////////////////////////////////////////////

//
// values
//

static inline void bmp_setbit(uint64_t *bmp, int index){
	bmp[index / 64] |= UINT64_C(1) << (index % 64);
}

static inline bool bmp_hassetbit(uint64_t *bmp, int index){
	int k = index / 64;
	uint64_t mask = UINT64_C(1) << (index % 64);
	if (bmp[k] & mask)
		return true;
	bmp[k] |= mask;
	return false;
}

static inline int bmp_alloc(uint64_t *bmp, int count){
	// search for the first 0 bit, flip it to 1, then return the position
	// return -1 if nothing found
	int loop = 0;
	while (count > 0){
		if (*bmp == UINT64_C(0xFFFFFFFFFFFFFFFF)){
			loop++;
			count -= 64;
			bmp++;
			continue;
		}

	#if defined(BITSCAN_FFSLL)
		int pos = ffsll(~*bmp) - 1;
	#elif defined(BITSCAN_WIN)
		unsigned long pos;
		_BitScanForward64(&pos, ~*bmp);
	#else
	#	error Don't know how to implement bmp_alloc
	#endif

		*bmp |= UINT64_C(1) << pos;
		return loop * 64 + pos;

	}
	return -1;
}

static int bmp_reserve(void **tbl, int *size, uint64_t **aloc, uint64_t **ref, size_t st_size){
	int index = bmp_alloc(*aloc, *size);
	if (index >= 0)
		return index;
	if (*size >= 0x3FFFFFFF){
		fprintf(stderr, "Out of memory!\n");
		exit(1);
		return -1;
	}
	int new_count = *size * 2;
	*tbl = mem_realloc(*tbl, st_size * new_count);
	*aloc = mem_realloc(*aloc, sizeof(uint64_t) * (new_count / 64));
	memset(&(*aloc)[*size / 64], 0, sizeof(uint64_t) * (*size / 64));
	*ref = mem_realloc(*ref, sizeof(uint64_t) * (new_count / 64));
	memset(&(*ref)[*size / 64], 0, sizeof(uint64_t) * *size / 64);
	*size = new_count;
	(*aloc)[new_count / 128] |= 1;
	return new_count / 2;
}

//
// context
//

typedef struct {
	int pc;
	int frame;
	int index;
	int lex_index;
} ccs_st, *ccs;

static inline void ccs_free(ccs c){
	mem_free(c);
}

static inline ccs ccs_new(int pc, int frame, int index, int lex_index){
	ccs c = mem_alloc(sizeof(ccs_st));
	c->pc = pc;
	c->frame = frame;
	c->index = index;
	c->lex_index = lex_index;
	return c;
}

typedef struct lxs_struct lxs_st, *lxs;
struct lxs_struct {
	sink_val vals[256];
	lxs next;
};

static inline void lxs_free(lxs ls){
	mem_free(ls);
}

static void lxs_freeAll(lxs ls){
	lxs here = ls;
	while (here){
		lxs del = here;
		here = here->next;
		lxs_free(del);
	}
}

static inline lxs lxs_new(int argcount, sink_val *args, lxs next){
	if (argcount > 256)
		argcount = 256;
	lxs ls = mem_alloc(sizeof(lxs_st));
	if (argcount > 0)
		memcpy(ls->vals, args, sizeof(sink_val) * argcount);
	for (int i = argcount; i < 256; i++)
		ls->vals[i] = SINK_NIL;
	ls->next = next;
	return ls;
}

typedef struct {
	void *natuser;
	sink_native_f f_native;
	uint64_t hash;
} native_st, *native;

static inline native native_new(uint64_t hash, void *natuser, sink_native_f f_native){
	native nat = mem_alloc(sizeof(native_st));
	nat->hash = hash;
	nat->natuser = natuser;
	nat->f_native = f_native;
	return nat;
}

typedef struct context_struct context_st, *context;

typedef struct {
	context ctx;
	sink_val result;
	sink_then_st then;
	bool has_then;
	bool has_result;
} wait_st, *waitt; // `waitt` has an extra `t` because `wait` is taken by Darwin >:-(

static inline waitt wait_new(){
	return mem_alloc(sizeof(wait_st));
}

static inline void wait_make(waitt w, context ctx){
	w->has_then = w->has_result = false;
	w->ctx = ctx;
}

static void wait_cancelfree(waitt w){
	if (w->has_then && w->then.f_cancel)
		w->then.f_cancel(w->then.user);
	mem_free(w);
}

struct context_struct {
	void *user;
	sink_free_f f_freeuser;
	cleanup cup;
	list_ptr natives;
	list_ptr wait_pending; // wait values that are still waiting to fully resolve

	program prg; // not freed by context_free
	list_ptr call_stk;
	list_ptr lex_stk;
	list_ptr f_finalize;
	list_ptr user_hint;
	list_ptr ccs_avail;
	list_ptr lxs_avail;
	list_ptr wait_avail;

	sink_io_st io;

	str_st *str_tbl;
	list_st *list_tbl;

	uint64_t *str_aloc;
	uint64_t *list_aloc;

	uint64_t *str_ref;
	uint64_t *list_ref;

	list_st pinned;

	int lex_index;
	int pc;
	int lastpc;
	int str_size;
	int list_size;
	int str_prealloc_size;
	int str_prealloc_memset;
	uint64_t str_prealloc_lastmask;
	int async_frame;
	int async_index;
	int timeout;
	int timeout_left;
	int gc_left;
	sink_gc_level gc_level;

	uint32_t rand_seed;
	uint32_t rand_i;

	char *err;
	bool passed;
	bool failed;
	bool async;
};

static inline lxs lxs_get(context ctx, int argcount, sink_val *args, lxs next){
	if (ctx->lxs_avail->size > 0){
		lxs ls = ctx->lxs_avail->ptrs[--ctx->lxs_avail->size];
		if (argcount > 0)
			memcpy(ls->vals, args, sizeof(sink_val) * argcount);
		for (int i = argcount; i < 256; i++)
			ls->vals[i] = SINK_NIL;
		ls->next = next;
		return ls;
	}
	return lxs_new(argcount, args, next);
}

static inline void lxs_release(context ctx, lxs ls){
	list_ptr_push(ctx->lxs_avail, ls);
}

static inline ccs ccs_get(context ctx, int pc, int frame, int index, int lex_index){
	if (ctx->ccs_avail->size > 0){
		ccs c = ctx->ccs_avail->ptrs[--ctx->ccs_avail->size];
		c->pc = pc;
		c->frame = frame;
		c->index = index;
		c->lex_index = lex_index;
		return c;
	}
	return ccs_new(pc, frame, index, lex_index);
}

static inline void ccs_release(context ctx, ccs c){
	list_ptr_push(ctx->ccs_avail, c);
}

static inline waitt wait_get(context ctx){
	waitt w;
	if (ctx->wait_avail->size > 0)
		w = ctx->wait_avail->ptrs[--ctx->wait_avail->size];
	else
		w = wait_new();
	list_ptr_push(ctx->wait_pending, w);
	return w;
}

static inline void wait_release(context ctx, waitt w){
	list_ptr_remove(ctx->wait_pending, list_ptr_find(ctx->wait_pending, w));
	list_ptr_push(ctx->wait_avail, w);
}

static inline void context_gcunpin(context ctx, sink_val v);
static inline void wait_fire(waitt w){
	if (w->then.f_then)
		w->then.f_then(w->ctx, w->result, w->then.user);
	context_gcunpin(w->ctx, w->result); // don't forget to unpin result
	wait_release(w->ctx, w);
}

static inline void context_cleanup(context ctx, void *cuser, sink_free_f f_free){
	cleanup_add(ctx->cup, cuser, f_free);
}

static inline sink_run opi_abortcstr(context ctx, const char *msg);

static inline void context_native(context ctx, uint64_t hash, void *natuser,
	sink_native_f f_native){
	if (ctx->prg->repl)
		list_ptr_push(ctx->natives, native_new(hash, natuser, f_native));
	else{
		for (int i = 0; i < ctx->natives->size; i++){
			native nat = ctx->natives->ptrs[i];
			if (nat->hash == hash){
				if (nat->f_native){
					// already defined, hash collision
					opi_abortcstr(ctx,
						"Hash collision; cannot redefine native command "
						"(did you call sink_ctx_native twice for the same command?)");
					return;
				}
				nat->natuser = natuser;
				nat->f_native = f_native;
				return;
			}
		}
	}
}

typedef void (*sweepfree_f)(context ctx, int index);

static void context_sweepfree_str(context ctx, int index){
	if (ctx->str_tbl[index].bytes)
		mem_free(ctx->str_tbl[index].bytes);
}

static void context_sweepfree_list(context ctx, int index){
	list_st *ls = &ctx->list_tbl[index];
	if (ls->usertype >= 0){
		sink_free_f f_free = ctx->f_finalize->ptrs[ls->usertype];
		if (f_free)
			f_free(ls->user);
	}
	if (ls->vals)
		mem_free(ls->vals);
}

static inline void context_sweephelp(context ctx, int size, uint64_t *aloc, uint64_t *ref,
	sweepfree_f f_free){
	int ms = size / 64;
	for (int i = 0; i < ms; i++){
		if (aloc[i] == ref[i])
			continue;
		int bi = 0;
		for (uint64_t bit = 1; bit != 0; bit <<= 1, bi++){
			// if we're not allocated, or we are referenced, then skip
			if ((aloc[i] & bit) == 0 || (ref[i] & bit) != 0)
				continue;
			// otherwise, free
			aloc[i] ^= bit;
			f_free(ctx, i * 64 + bi);
		}
	}
}

static inline void context_sweep(context ctx){
	context_sweephelp(ctx, ctx->str_size, ctx->str_aloc, ctx->str_ref, context_sweepfree_str);
	context_sweephelp(ctx, ctx->list_size, ctx->list_aloc, ctx->list_ref, context_sweepfree_list);
}

static inline int var_index(sink_val v){
	return (int)(v.u & SINK_INDEX_MASK);
}

static void context_markvals(context ctx, int size, sink_val *vals){
	for (int i = 0; i < size; i++){
		if (sink_isstr(vals[i])){
			int idx = var_index(vals[i]);
			bmp_setbit(ctx->str_ref, idx);
		}
		else if (sink_islist(vals[i])){
			int idx = var_index(vals[i]);
			if (!bmp_hassetbit(ctx->list_ref, idx)){
				list_st *ls = &ctx->list_tbl[idx];
				context_markvals(ctx, ls->size, ls->vals);
			}
		}
	}
}

static inline void context_clearref(context ctx){
	memset(ctx->str_ref, 0, sizeof(uint64_t) * (ctx->str_size / 64));
	memset(ctx->list_ref, 0, sizeof(uint64_t) * (ctx->list_size / 64));
	// mark the string table since it isn't owned by the context
	if (ctx->str_prealloc_memset > 0)
		memset(ctx->str_ref, 0xFF, sizeof(uint64_t) * ctx->str_prealloc_memset);
	ctx->str_ref[ctx->str_prealloc_memset] = ctx->str_prealloc_lastmask;
}

static inline void context_mark(context ctx){
	context_markvals(ctx, ctx->pinned.size, ctx->pinned.vals);
	for (int i = 0; i < ctx->lex_stk->size; i++){
		lxs here = ctx->lex_stk->ptrs[i];
		while (here){
			context_markvals(ctx, 256, here->vals);
			here = here->next;
		}
	}
}

static inline void context_gcleft(context ctx, bool set){
	if (set){
		if (ctx->gc_level == SINK_GC_DEFAULT)
			ctx->gc_left = 10000;
		else if (ctx->gc_level == SINK_GC_LOWMEM)
			ctx->gc_left = 1000;
	}
	else{
		if (ctx->gc_level == SINK_GC_DEFAULT){
			if (ctx->gc_left > 10000)
				ctx->gc_left = 10000;
		}
		else if (ctx->gc_level == SINK_GC_LOWMEM){
			if (ctx->gc_left > 1000)
				ctx->gc_left = 1000;
		}
	}
}

static inline void context_gc(context ctx){
	context_clearref(ctx);
	context_mark(ctx);
	context_sweep(ctx);
	context_gcleft(ctx, true);
	if (ctx->timeout_left <= SINK_GC_TICKS)
		ctx->timeout_left = 0;
	else
		ctx->timeout_left -= SINK_GC_TICKS;
}

static const int sink_pin_grow = 50;
static inline void context_gcpin(context ctx, sink_val v){
	if (!sink_isstr(v) && !sink_islist(v))
		return;
	if (ctx->pinned.size >= ctx->pinned.count){
		ctx->pinned.count += sink_pin_grow;
		ctx->pinned.vals = mem_realloc(ctx->pinned.vals, sizeof(sink_val) * ctx->pinned.count);
	}
	ctx->pinned.vals[ctx->pinned.size++] = v;
}

static inline void context_gcunpin(context ctx, sink_val v){
	if (!sink_isstr(v) && !sink_islist(v))
		return;
	// only remove the value once, even if it appears multiple times, so that the user can use
	// pin/unpin as a stack-like operation
	for (int i = 0; i < ctx->pinned.size; i++){
		if (ctx->pinned.vals[i].u == v.u){
			if (i < ctx->pinned.size - 1){
				memmove(&ctx->pinned.vals[i], &ctx->pinned.vals[i + 1],
					sizeof(sink_val) * (ctx->pinned.size - 1 - i));
			}
			ctx->pinned.size--;
			return;
		}
	}
}

static inline void context_free(context ctx){
	if (ctx->f_freeuser)
		ctx->f_freeuser(ctx->user);
	cleanup_free(ctx->cup);
	list_ptr_free(ctx->natives);
	list_ptr_free(ctx->wait_pending);
	context_clearref(ctx);
	context_sweep(ctx);
	list_ptr_free(ctx->wait_avail);
	list_ptr_free(ctx->ccs_avail);
	list_ptr_free(ctx->lxs_avail);
	list_ptr_free(ctx->call_stk);
	list_ptr_free(ctx->lex_stk);
	list_ptr_free(ctx->f_finalize);
	list_ptr_free(ctx->user_hint);
	if (ctx->err)
		mem_free(ctx->err);
	mem_free(ctx->list_tbl);
	mem_free(ctx->str_tbl);
	mem_free(ctx->list_aloc);
	mem_free(ctx->str_aloc);
	mem_free(ctx->list_ref);
	mem_free(ctx->str_ref);
	mem_free(ctx->pinned.vals);
	mem_free(ctx);
}

static void opi_rand_seedauto(context ctx);

static inline context context_new(program prg, sink_io_st io){
	context ctx = mem_alloc(sizeof(context_st));
	ctx->user = NULL;
	ctx->f_freeuser = NULL;
	ctx->cup = cleanup_new();
	ctx->natives = list_ptr_new(mem_free_func);
	ctx->wait_pending = list_ptr_new(wait_cancelfree);
	ctx->call_stk = list_ptr_new(ccs_free);
	ctx->lex_stk = list_ptr_new(lxs_freeAll);
	list_ptr_push(ctx->lex_stk, lxs_new(0, NULL, NULL));
	ctx->ccs_avail = list_ptr_new(ccs_free);
	ctx->lxs_avail = list_ptr_new(lxs_free);
	ctx->wait_avail = list_ptr_new(mem_free_func);
	ctx->prg = prg;
	ctx->f_finalize = list_ptr_new(NULL);
	ctx->user_hint = list_ptr_new(NULL);

	ctx->io = io;

	if (prg->repl){
		ctx->str_prealloc_size = 0;
		ctx->str_size = 64;
	}
	else{
		ctx->str_prealloc_size = ctx->prg->strTable->size;
		ctx->str_size = ctx->str_prealloc_size + 64;
		ctx->str_size += 64 - (ctx->str_size % 64); // round up to number divisible by 64
		// if not a REPL, then natives can be built now
		for (int i = 0; i < prg->keyTable->size; i++)
			list_ptr_push(ctx->natives, native_new(prg->keyTable->vals[i], NULL, NULL));
	}
	ctx->list_size = 64;

	ctx->str_tbl = mem_alloc(sizeof(str_st) * ctx->str_size);
	ctx->list_tbl = mem_alloc(sizeof(list_st) * ctx->list_size);

	ctx->str_aloc = mem_alloc(sizeof(uint64_t) * (ctx->str_size / 64));
	memset(ctx->str_aloc, 0, sizeof(uint64_t) * (ctx->str_size / 64));
	ctx->list_aloc = mem_alloc(sizeof(uint64_t) * (ctx->list_size / 64));
	memset(ctx->list_aloc, 0, sizeof(uint64_t) * (ctx->list_size / 64));

	ctx->str_ref = mem_alloc(sizeof(uint64_t) * (ctx->str_size / 64));
	ctx->list_ref = mem_alloc(sizeof(uint64_t) * (ctx->list_size / 64));

	ctx->pinned.size = 0;
	ctx->pinned.count = 50;
	ctx->pinned.vals = mem_alloc(sizeof(sink_val) * ctx->pinned.count);

	ctx->lex_index = 0;
	ctx->pc = 0;
	ctx->timeout = 0;
	ctx->timeout_left = 0;
	ctx->gc_level = SINK_GC_DEFAULT;
	ctx->rand_seed = 0;
	ctx->rand_i = 0;

	ctx->err = NULL;
	ctx->passed = false;
	ctx->failed = false;
	ctx->async = false;

	if (prg->repl){
		ctx->str_prealloc_memset = 0;
		ctx->str_prealloc_lastmask = 0;
	}
	else{
		// reserve locations for the string table, such that string table index == var_index
		for (int i = 0; i < ctx->prg->strTable->size; i++){
			list_byte s = ctx->prg->strTable->ptrs[i];
			sink_str_newblobgive(ctx, s->size, s->bytes);
		}

		// precalculate the values needed to mark the prealloc'ed string table quickly
		ctx->str_prealloc_memset = ctx->str_prealloc_size / 64;
		int str_left = ctx->str_prealloc_size % 64;
		ctx->str_prealloc_lastmask = 0;
		while (str_left > 0){
			ctx->str_prealloc_lastmask = (ctx->str_prealloc_lastmask << 1) | 1;
			str_left--;
		}
	}

	context_gcleft(ctx, true);
	opi_rand_seedauto(ctx);
	return ctx;
}

static inline void context_reset(context ctx){
	// return to the top level
	while (ctx->call_stk->size > 0){
		ccs s = list_ptr_pop(ctx->call_stk);
		lxs lx = ctx->lex_stk->ptrs[ctx->lex_index];
		ctx->lex_stk->ptrs[ctx->lex_index] = lx->next;
		lxs_release(ctx, lx);
		ctx->lex_index = s->lex_index;
		ctx->pc = s->pc;
		ccs_release(ctx, s);
	}
	// reset variables and fast-forward to the end of the current program
	ctx->passed = false;
	ctx->failed = false;
	ctx->pc = ctx->prg->ops->size;
	ctx->timeout_left = ctx->timeout;
}

static inline sink_val var_get(context ctx, int frame, int index){
	return ((lxs)ctx->lex_stk->ptrs[frame])->vals[index];
}

static inline void var_set(context ctx, int frame, int index, sink_val val){
	((lxs)ctx->lex_stk->ptrs[frame])->vals[index] = val;
}

static inline str_st var_caststr(context ctx, sink_val a){
	return ctx->str_tbl[var_index(a)];
}

static inline str_st *var_castmstr(context ctx, sink_val a){
	return &ctx->str_tbl[var_index(a)];
}

static inline list_st var_castlist(context ctx, sink_val a){
	return ctx->list_tbl[var_index(a)];
}

static inline list_st *var_castmlist(context ctx, sink_val a){
	return &ctx->list_tbl[var_index(a)];
}

static inline sink_val arget(context ctx, sink_val ar, int index){
	if (sink_islist(ar)){
		list_st ls = var_castlist(ctx, ar);
		return index >= ls.size ? (sink_val){ .f = 0 } : ls.vals[index];
	}
	return ar;
}

static inline int arsize(context ctx, sink_val ar){
	if (sink_islist(ar)){
		list_st ls = var_castlist(ctx, ar);
		return ls.size;
	}
	return 1;
}

static const int LT_ALLOWNIL = 1;
static const int LT_ALLOWNUM = 2;
static const int LT_ALLOWSTR = 4;

static inline bool oper_typemask(sink_val a, int mask){
	switch (sink_typeof(a)){
		case SINK_TYPE_NIL    : return (mask & LT_ALLOWNIL) != 0;
		case SINK_TYPE_NUM    : return (mask & LT_ALLOWNUM) != 0;
		case SINK_TYPE_STR    : return (mask & LT_ALLOWSTR) != 0;
		case SINK_TYPE_LIST   : return false;
	}
}

static inline bool oper_typelist(context ctx, sink_val a, int mask){
	if (sink_islist(a)){
		list_st ls = var_castlist(ctx, a);
		for (int i = 0; i < ls.size; i++){
			if (!oper_typemask(ls.vals[i], mask))
				return false;
		}
		return true;
	}
	return oper_typemask(a, mask);
}

typedef sink_val (*unary_f)(context ctx, sink_val v);

static sink_val oper_un(context ctx, sink_val a, unary_f f_unary){
	if (sink_islist(a)){
		list_st ls = var_castlist(ctx, a);
		if (ls.size <= 0)
			return sink_list_newempty(ctx);
		sink_val *ret = mem_alloc(sizeof(sink_val) * ls.size);
		for (int i = 0; i < ls.size; i++)
			ret[i] = f_unary(ctx, ls.vals[i]);
		return sink_list_newblobgive(ctx, ls.size, ls.size, ret);
	}
	return f_unary(ctx, a);
}

typedef sink_val (*binary_f)(context ctx, sink_val a, sink_val b);

static sink_val oper_bin(context ctx, sink_val a, sink_val b, binary_f f_binary){
	if (sink_islist(a) || sink_islist(b)){
		int ma = arsize(ctx, a);
		int mb = arsize(ctx, b);
		int m = ma > mb ? ma : mb;
		if (m <= 0)
			return sink_list_newempty(ctx);
		sink_val *ret = mem_alloc(sizeof(sink_val) * m);
		for (int i = 0; i < m; i++)
			ret[i] = f_binary(ctx, arget(ctx, a, i), arget(ctx, b, i));
		return sink_list_newblobgive(ctx, m, m, ret);
	}
	return f_binary(ctx, a, b);
}

typedef sink_val (*trinary_f)(context ctx, sink_val a, sink_val b, sink_val c);

static sink_val oper_tri(context ctx, sink_val a, sink_val b, sink_val c, trinary_f f_trinary){
	if (sink_islist(a) || sink_islist(b) || sink_islist(c)){
		int ma = arsize(ctx, a);
		int mb = arsize(ctx, b);
		int mc = arsize(ctx, c);
		int m = ma > mb ? (ma > mc ? ma : mc) : (mb > mc ? mb : mc);
		if (m <= 0)
			return sink_list_newempty(ctx);
		sink_val *ret = mem_alloc(sizeof(sink_val) * m);
		for (int i = 0; i < m; i++)
			ret[i] = f_trinary(ctx, arget(ctx, a, i), arget(ctx, b, i), arget(ctx, c, i));
		return sink_list_newblobgive(ctx, m, m, ret);
	}
	return f_trinary(ctx, a, b, c);
}

static int str_cmp(str_st a, str_st b){
	int m = a.size > b.size ? b.size : a.size;
	for (int i = 0; i < m; i++){
		uint8_t c1 = a.bytes[i];
		uint8_t c2 = b.bytes[i];
		if (c1 < c2)
			return -1;
		else if (c2 < c1)
			return 1;
	}
	if (a.size < b.size)
		return -1;
	else if (b.size < a.size)
		return 1;
	return 0;
}

static sink_val opihelp_num_max(context ctx, int size, sink_val *vals, list_int li){
	sink_val max = SINK_NIL;
	for (int i = 0; i < size; i++){
		if (sink_isnum(vals[i])){
			if (sink_isnil(max) || vals[i].f > max.f)
				max = vals[i];
		}
		else if (sink_islist(vals[i])){
			int idx = var_index(vals[i]);
			if (list_int_has(li, idx))
				return SINK_NIL;
			list_int_push(li, idx);

			list_st ls = var_castlist(ctx, vals[i]);
			sink_val lm = opihelp_num_max(ctx, ls.size, ls.vals, li);
			if (!sink_isnil(lm) && (sink_isnil(max) || lm.f > max.f))
				max = lm;

			list_int_pop(li);
		}
	}
	return max;
}

static inline sink_val opi_num_max(context ctx, int size, sink_val *vals){
	list_int li = list_int_new();
	sink_val res = opihelp_num_max(ctx, size, vals, li);
	list_int_free(li);
	return res;
}

static sink_val opihelp_num_min(context ctx, int size, sink_val *vals, list_int li){
	sink_val min = SINK_NIL;
	for (int i = 0; i < size; i++){
		if (sink_isnum(vals[i])){
			if (sink_isnil(min) || vals[i].f < min.f)
				min = vals[i];
		}
		else if (sink_islist(vals[i])){
			int idx = var_index(vals[i]);
			if (list_int_has(li, idx))
				return SINK_NIL;
			list_int_push(li, idx);

			list_st ls = var_castlist(ctx, vals[i]);
			sink_val lm = opihelp_num_min(ctx, ls.size, ls.vals, li);
			if (!sink_isnil(lm) && (sink_isnil(min) || lm.f < min.f))
				min = lm;

			list_int_pop(li);
		}
	}
	return min;
}

static inline sink_val opi_num_min(context ctx, int size, sink_val *vals){
	list_int li = list_int_new();
	sink_val res = opihelp_num_min(ctx, size, vals, li);
	list_int_free(li);
	return res;
}

static sink_val opi_num_base(context ctx, double num, int len, int base){
	if (len > 256)
		len = 256;
	const char *digits = "0123456789ABCDEF";
	char buf[100];
	int p = 0;

	if (num < 0){
		buf[p++] = '-';
		num = -num;
	}

	buf[p++] = '0';
	if (base == 16)
		buf[p++] = 'x';
	else if (base == 8)
		buf[p++] = 'c';
	else if (base == 2)
		buf[p++] = 'b';
	else
		assert(false);

	char buf2[100];
	int bodysize = 0;
	double nint = floor(num);
	double nfra = num - nint;
	while (nint > 0 && bodysize < 50){
		buf2[bodysize++] = digits[(int)fmod(nint, base)];
		nint = floor(nint / base);
	}
	int bi = 0;
	while (bodysize + bi < len && bodysize + bi < 32 && p < 50){
		buf[p++] = '0';
		bi++;
	}
	if (bodysize > 0){
		for (int i = 0; i < bodysize; i++)
			buf[p++] = buf2[bodysize - 1 - i];
	}
	else if (len <= 0)
		buf[p++] = '0';

	if (nfra > 0.00001){
		buf[p++] = '.';
		int i = 0;
		while (nfra > 0.00001 && i < 16){
			nfra *= base;
			nint = floor(nfra);
			buf[p++] = digits[(int)nint];
			nfra -= nint;
			i++;
		}
	}

	buf[p++] = 0;
	return sink_str_newcstr(ctx, buf);
}

static inline uint32_t opi_rand_int(context ctx);

static inline void opi_rand_seedauto(context ctx){
	ctx->rand_seed = sink_seedauto_src();
	ctx->rand_i = sink_seedauto_src();
	for (int i = 0; i < 1000; i++)
		opi_rand_int(ctx);
	ctx->rand_i = 0;
}

static inline void opi_rand_seed(context ctx, uint32_t n){
	ctx->rand_seed = n;
	ctx->rand_i = 0;
}

static inline uint32_t opi_rand_int(context ctx){
	uint32_t m = 0x5bd1e995;
	uint32_t k = ctx->rand_i++ * m;
	ctx->rand_seed = (k ^ (k >> 24) ^ (ctx->rand_seed * m)) * m;
	return ctx->rand_seed ^ (ctx->rand_seed >> 13);
}

static inline double opi_rand_num(context ctx){
	uint64_t M1 = opi_rand_int(ctx);
	uint64_t M2 = opi_rand_int(ctx);
	uint64_t M = (M1 << 20) | (M2 >> 12); // 52 bit random number
	union { uint64_t i; double d; } u = {
		.i = UINT64_C(0x3FF) << 52 | M
	};
	return u.d - 1.0;
}

static inline sink_val opi_rand_range(context ctx, double start, double stop, double step){
	if (start == stop)
		return SINK_NIL;
	if (step == 0){
		opi_abortcstr(ctx, "Range step cannot be 0");
		return SINK_NIL;
	}
	double count = ceil((stop - start) / step);
	if (count <= 0)
		return SINK_NIL;
	return sink_num(start + floor(opi_rand_num(ctx) * count) * step);
}

static inline sink_val opi_rand_getstate(context ctx){
	double vals[2] = { ctx->rand_seed, ctx->rand_i };
	return sink_list_newblob(ctx, 2, (sink_val *)vals);
}

static inline void opi_rand_setstate(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list of two integers");
		return;
	}
	list_st ls = var_castlist(ctx, a);
	if (ls.size < 2 || !sink_isnum(ls.vals[0]) || !sink_isnum(ls.vals[1])){
		opi_abortcstr(ctx, "Expecting list of two integers");
		return;
	}
	ctx->rand_seed = (uint32_t)ls.vals[0].f;
	ctx->rand_i = (uint32_t)ls.vals[1].f;
}

static inline sink_val opi_rand_pick(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list");
		return SINK_NIL;
	}
	list_st ls = var_castlist(ctx, a);
	if (ls.size <= 0)
		return SINK_NIL;
	return ls.vals[(int)(opi_rand_num(ctx) * ls.size)];
}

static inline void opi_rand_shuffle(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list");
		return;
	}
	list_st ls = var_castlist(ctx, a);
	int m = ls.size;
	while (m > 1){
		int i = (int)(opi_rand_num(ctx) * m);
		m--;
		if (m != i){
			sink_val t = ls.vals[m];
			ls.vals[m] = ls.vals[i];
			ls.vals[i] = t;
		}
	}
}

static inline sink_val opi_str_new(context ctx, int size, sink_val *vals){
	return sink_list_joinplain(ctx, size, vals, 1, (const uint8_t *)" ");
}

static inline sink_val opi_list_push(context ctx, sink_val a, sink_val b);
static inline sink_val opi_str_split(context ctx, sink_val a, sink_val b){
	if ((!sink_isstr(a) && !sink_isnum(a)) || (!sink_isstr(b) && !sink_isnum(b))){
		opi_abortcstr(ctx, "Expecting strings");
		return SINK_NIL;
	}
	a = sink_tostr(ctx, a);
	b = sink_tostr(ctx, b);
	str_st haystack = var_caststr(ctx, a);
	str_st needle = var_caststr(ctx, b);
	sink_val result = sink_list_newempty(ctx);

	int nlen = needle.size;
	int hlen = haystack.size;
	if (nlen <= 0){
		// split on every character
		for (int i = 0; i < hlen; i++)
			opi_list_push(ctx, result, sink_str_newblob(ctx, 1, &haystack.bytes[i]));
		return result;
	}

	int delta[256];
	for (int i = 0; i < 256; i++)
		delta[i] = nlen + 1;
	for (int i = 0; i < nlen; i++)
		delta[needle.bytes[i]] = nlen - i;
	int hx = 0;
	int lastmatch = 0;
	while (hx + nlen <= hlen){
		if (memcmp(needle.bytes, &haystack.bytes[hx], sizeof(uint8_t) * nlen) == 0){
			opi_list_push(ctx, result,
				sink_str_newblob(ctx, hx - lastmatch, &haystack.bytes[lastmatch]));
			lastmatch = hx + needle.size;
			hx += needle.size;
		}
		else{
			// note: in all these search string functions we use the same basic algorithm, and we
			// are allowed to access hx+nlen because all sink strings are guaranteed to be NULL
			// terminated
			hx += delta[haystack.bytes[hx + nlen]];
		}
	}
	opi_list_push(ctx, result,
		sink_str_newblob(ctx, haystack.size - lastmatch, &haystack.bytes[lastmatch]));
	return result;
}

static inline sink_val opi_list_join(context ctx, sink_val a, sink_val b);
static inline sink_val opi_str_replace(context ctx, sink_val a, sink_val b, sink_val c){
	sink_val ls = opi_str_split(ctx, a, b);
	if (ctx->failed)
		return SINK_NIL;
	return opi_list_join(ctx, ls, c);
}

static inline sink_val opi_str_find(context ctx, sink_val a, sink_val b, sink_val c){
	int hx;
	if (sink_isnil(c))
		hx = 0;
	else if (sink_isnum(c))
		hx = c.f;
	else{
		opi_abortcstr(ctx, "Expecting number");
		return SINK_NIL;
	}
	if ((!sink_isstr(a) && !sink_isnum(a)) || (!sink_isstr(b) && !sink_isnum(b))){
		opi_abortcstr(ctx, "Expecting strings");
		return SINK_NIL;
	}
	a = sink_tostr(ctx, a);
	b = sink_tostr(ctx, b);
	str_st haystack = var_caststr(ctx, a);
	str_st needle = var_caststr(ctx, b);

	int nlen = needle.size;
	if (nlen <= 0)
		return sink_num(0);

	int hlen = haystack.size;
	int delta[256];
	for (int i = 0; i < 256; i++)
		delta[i] = nlen + 1;
	for (int i = 0; i < nlen; i++)
		delta[needle.bytes[i]] = nlen - i;
	if (hx < 0)
		hx += hlen;
	if (hx < 0)
		hx = 0;
	while (hx + nlen <= hlen){
		if (memcmp(needle.bytes, &haystack.bytes[hx], sizeof(uint8_t) * nlen) == 0)
			return sink_num(hx);
		hx += delta[haystack.bytes[hx + nlen]];
	}
	return SINK_NIL;
}

static inline sink_val opi_str_rfind(context ctx, sink_val a, sink_val b, sink_val c){
	int hx;
	if (sink_isnum(c))
		hx = c.f;
	else if (!sink_isnil(c)){
		opi_abortcstr(ctx, "Expecting number");
		return SINK_NIL;
	}
	if ((!sink_isstr(a) && !sink_isnum(a)) || (!sink_isstr(b) && !sink_isnum(b))){
		opi_abortcstr(ctx, "Expecting strings");
		return SINK_NIL;
	}
	a = sink_tostr(ctx, a);
	b = sink_tostr(ctx, b);
	str_st haystack = var_caststr(ctx, a);
	str_st needle = var_caststr(ctx, b);

	int nlen = needle.size;
	int hlen = haystack.size;
	if (nlen <= 0)
		return sink_num(hlen);

	if (sink_isnil(c))
		hx = hlen - nlen;

	int delta[256];
	for (int i = 0; i < 256; i++)
		delta[i] = nlen + 1;
	for (int i = nlen - 1; i >= 0; i--)
		delta[needle.bytes[i]] = i + 1;
	if (hx < 0)
		hx += hlen;
	if (hx > hlen - nlen)
		hx = hlen - nlen;
	while (hx >= 0){
		if (memcmp(needle.bytes, &haystack.bytes[hx], sizeof(uint8_t) * nlen) == 0)
			return sink_num(hx);
		if (hx <= 0){
			// searching backwards we can't access bytes[-1] because we aren't "reverse" NULL
			// terminated... we would just crash
			return SINK_NIL;
		}
		hx -= delta[haystack.bytes[hx - 1]];
	}
	return SINK_NIL;
}

static inline bool opi_str_begins(context ctx, sink_val a, sink_val b){
	if ((!sink_isstr(a) && !sink_isnum(a)) || (!sink_isstr(b) && !sink_isnum(b))){
		opi_abortcstr(ctx, "Expecting strings");
		return false;
	}
	str_st s1 = var_caststr(ctx, sink_tostr(ctx, a));
	str_st s2 = var_caststr(ctx, sink_tostr(ctx, b));
	return s1.size >= s2.size && memcmp(s1.bytes, s2.bytes, sizeof(uint8_t) * s2.size) == 0;
}

static inline bool opi_str_ends(context ctx, sink_val a, sink_val b){
	if ((!sink_isstr(a) && !sink_isnum(a)) || (!sink_isstr(b) && !sink_isnum(b))){
		opi_abortcstr(ctx, "Expecting strings");
		return false;
	}
	str_st s1 = var_caststr(ctx, sink_tostr(ctx, a));
	str_st s2 = var_caststr(ctx, sink_tostr(ctx, b));
	return s1.size >= s2.size &&
		memcmp(&s1.bytes[s1.size - s2.size], s2.bytes, sizeof(uint8_t) * s2.size) == 0;
}

static inline sink_val opi_str_pad(context ctx, sink_val a, int b){
	if (!sink_isstr(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	a = sink_tostr(ctx, a);
	str_st s = var_caststr(ctx, a);
	if (b < 0){ // left pad
		b = -b;
		if (s.size >= b)
			return a;
		uint8_t *ns = mem_alloc(sizeof(uint8_t) * (b + 1));
		memset(ns, 32, sizeof(uint8_t) * (b - s.size));
		if (s.size > 0)
			memcpy(&ns[b - s.size], s.bytes, sizeof(uint8_t) * s.size);
		ns[b] = 0;
		return sink_str_newblobgive(ctx, b, ns);
	}
	else{ // right pad
		if (s.size >= b)
			return a;
		uint8_t *ns = mem_alloc(sizeof(uint8_t) * (b + 1));
		if (s.size > 0)
			memcpy(ns, s.bytes, sizeof(uint8_t) * s.size);
		memset(&ns[s.size], 32, sizeof(uint8_t) * (b - s.size));
		ns[b] = 0;
		return sink_str_newblobgive(ctx, b, ns);
	}
}

static inline sink_val opihelp_str_lower(context ctx, sink_val a){
	if (!sink_isstr(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, sink_tostr(ctx, a));
	uint8_t *b = mem_alloc(sizeof(uint8_t) * (s.size + 1));
	for (int i = 0; i <= s.size; i++){
		int ch = s.bytes[i];
		if (ch >= 'A' && ch <= 'Z')
			ch = ch - 'A' + 'a';
		b[i] = ch;
	}
	return sink_str_newblobgive(ctx, s.size, b);
}

static inline sink_val opihelp_str_upper(context ctx, sink_val a){
	if (!sink_isstr(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, sink_tostr(ctx, a));
	uint8_t *b = mem_alloc(sizeof(uint8_t) * (s.size + 1));
	for (int i = 0; i <= s.size; i++){
		int ch = s.bytes[i];
		if (ch >= 'a' && ch <= 'z')
			ch = ch - 'a' + 'A';
		b[i] = ch;
	}
	return sink_str_newblobgive(ctx, s.size, b);
}

static inline bool shouldtrim(uint8_t c){
	return (c >= 9 && c <= 13) || c == 32;
}

static inline sink_val opihelp_str_trim(context ctx, sink_val a){
	if (!sink_isstr(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	a = sink_tostr(ctx, a);
	str_st s = var_caststr(ctx, a);
	int len1 = 0;
	int len2 = 0;
	while (len1 < s.size && shouldtrim(s.bytes[len1]))
		len1++;
	while (len2 < s.size && shouldtrim(s.bytes[s.size - 1 - len2]))
		len2++;
	if (len1 == 0 && len2 == 0)
		return a;
	int size = s.size - len1 - len2;
	uint8_t *b = NULL;
	if (size > 0){
		b = mem_alloc(sizeof(uint8_t) * (size + 1));
		memcpy(b, &s.bytes[len1], sizeof(uint8_t) * size);
		b[size] = 0;
	}
	return sink_str_newblobgive(ctx, size < 0 ? 0 : size, b);
}

static inline sink_val opihelp_str_rev(context ctx, sink_val a){
	if (!sink_isstr(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	a = sink_tostr(ctx, a);
	str_st s = var_caststr(ctx, a);
	if (s.size <= 0)
		return a;
	uint8_t *b = mem_alloc(sizeof(uint8_t) * (s.size + 1));
	for (int i = 0; i < s.size; i++)
		b[s.size - i - 1] = s.bytes[i];
	b[s.size] = 0;
	return sink_str_newblobgive(ctx, s.size, b);
}

#define OPI_STR_UNOP(name, single)                                       \
	static inline sink_val name(context ctx, sink_val a){                \
		if (sink_islist(a)){                                             \
			list_st ls = var_castlist(ctx, a);                           \
			if (ls.size <= 0)                                            \
				return sink_list_newempty(ctx);                          \
			sink_val *ret = mem_alloc(sizeof(sink_val) * ls.size);       \
			for (int i = 0; i < ls.size; i++)                            \
				ret[i] = single(ctx, ls.vals[i]);                        \
			return sink_list_newblobgive(ctx, ls.size, ls.size, ret);    \
		}                                                                \
		return single(ctx, a);                                           \
	}
// allow unary string commands to work on lists too
OPI_STR_UNOP(opi_str_lower, opihelp_str_lower)
OPI_STR_UNOP(opi_str_upper, opihelp_str_upper)
OPI_STR_UNOP(opi_str_trim , opihelp_str_trim )
OPI_STR_UNOP(opi_str_rev  , opihelp_str_rev  )
#undef OPI_STR_UNOP

static inline sink_val opi_str_rep(context ctx, sink_val a, int rep){
	if (!sink_isstr(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	if (rep <= 0)
		return sink_str_newblobgive(ctx, 0, NULL);
	a = sink_tostr(ctx, a);
	if (rep == 1)
		return a;
	str_st s = var_caststr(ctx, a);
	if (s.size <= 0)
		return a;
	int64_t size = (int64_t)s.size * (int64_t)rep;
	if (size > 100000000){
		opi_abortcstr(ctx, "Constructed string is too large");
		return SINK_NIL;
	}
	uint8_t *b = mem_alloc(sizeof(uint8_t) * (size + 1));
	for (int i = 0; i < rep; i++)
		memcpy(&b[i * s.size], s.bytes, sizeof(uint8_t) * s.size);
	b[size] = 0;
	return sink_str_newblobgive(ctx, size, b);
}

static inline sink_val opi_str_list(context ctx, sink_val a){
	if (!sink_isstr(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, sink_tostr(ctx, a));
	sink_val r = sink_list_newempty(ctx);
	for (int i = 0; i < s.size; i++)
		opi_list_push(ctx, r, sink_num(s.bytes[i]));
	return r;
}

static inline sink_val opi_str_byte(context ctx, sink_val a, int b){
	if (!sink_isstr(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, sink_tostr(ctx, a));
	if (b < 0)
		b += s.size;
	if (b < 0 || b >= s.size)
		return SINK_NIL;
	return sink_num(s.bytes[b]);
}

static inline sink_val opi_str_hash(context ctx, sink_val a, uint32_t seed){
	if (!sink_isstr(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, sink_tostr(ctx, a));
	uint32_t out[4];
	sink_str_hashplain(s.size, s.bytes, seed, out);
	sink_val outv[4];
	outv[0] = sink_num(out[0]);
	outv[1] = sink_num(out[1]);
	outv[2] = sink_num(out[2]);
	outv[3] = sink_num(out[3]);
	return sink_list_newblob(ctx, 4, outv);
}

// 1   7  U+00000  U+00007F  0xxxxxxx
// 2  11  U+00080  U+0007FF  110xxxxx  10xxxxxx
// 3  16  U+00800  U+00FFFF  1110xxxx  10xxxxxx  10xxxxxx
// 4  21  U+10000  U+10FFFF  11110xxx  10xxxxxx  10xxxxxx  10xxxxxx

static inline bool opihelp_codepoint(sink_val b){
	return sink_isnum(b) && // must be a number
		floorf(b.f) == b.f && // must be an integer
		b.f >= 0 && b.f < 0x110000 && // must be within total range
		(b.f < 0xD800 || b.f >= 0xE000); // must not be a surrogate
}

static inline bool opi_utf8_valid(context ctx, sink_val a){
	if (sink_isstr(a)){
		str_st s = var_caststr(ctx, a);
		int state = 0;
		int codepoint = 0;
		int min = 0;
		for (int i = 0; i < s.size; i++){
			uint8_t b = s.bytes[i];
			if (state == 0){
				if (b < 0x80) // 0x00 to 0x7F
					continue;
				else if (b < 0xC0) // 0x80 to 0xBF
					return false;
				else if (b < 0xE0){ // 0xC0 to 0xDF
					codepoint = b & 0x1F;
					min = 0x80;
					state = 1;
				}
				else if (b < 0xF0){ // 0xE0 to 0xEF
					codepoint = b & 0x0F;
					min = 0x800;
					state = 2;
				}
				else if (b < 0xF8){ // 0xF0 to 0xF7
					codepoint = b & 0x07;
					min = 0x10000;
					state = 3;
				}
				else
					return false;
			}
			else{
				if (b < 0x80 || b >= 0xC0)
					return false;
				codepoint = (codepoint << 6) | (b & 0x3F);
				state--;
				if (state == 0){ // codepoint finished, check if invalid
					if (codepoint < min || // no overlong
						codepoint >= 0x110000 || // no huge
						(codepoint >= 0xD800 && codepoint < 0xE000)) // no surrogates
						return false;
				}
			}
		}
		return state == 0;
	}
	else if (sink_islist(a)){
		list_st ls = var_castlist(ctx, a);
		for (int i = 0; i < ls.size; i++){
			if (!opihelp_codepoint(ls.vals[i]))
				return false;
		}
		return true;
	}
	return false;
}

static inline sink_val opi_utf8_list(context ctx, sink_val a){
	if (!sink_isstr(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, a);
	sink_val res = sink_list_newempty(ctx);
	int state = 0;
	int codepoint = 0;
	int min = 0;
	for (int i = 0; i < s.size; i++){
		uint8_t b = s.bytes[i];
		if (state == 0){
			if (b < 0x80) // 0x00 to 0x7F
				opi_list_push(ctx, res, sink_num(b));
			else if (b < 0xC0) // 0x80 to 0xBF
				goto fail;
			else if (b < 0xE0){ // 0xC0 to 0xDF
				codepoint = b & 0x1F;
				min = 0x80;
				state = 1;
			}
			else if (b < 0xF0){ // 0xE0 to 0xEF
				codepoint = b & 0x0F;
				min = 0x800;
				state = 2;
			}
			else if (b < 0xF8){ // 0xF0 to 0xF7
				codepoint = b & 0x07;
				min = 0x10000;
				state = 3;
			}
			else
				goto fail;
		}
		else{
			if (b < 0x80 || b >= 0xC0)
				goto fail;
			codepoint = (codepoint << 6) | (b & 0x3F);
			state--;
			if (state == 0){ // codepoint finished, check if invalid
				if (codepoint < min || // no overlong
					codepoint >= 0x110000 || // no huge
					(codepoint >= 0xD800 && codepoint < 0xE000)) // no surrogates
					goto fail;
				opi_list_push(ctx, res, sink_num(codepoint));
			}
		}
	}
	return res;
	fail:
	opi_abortcstr(ctx, "Invalid UTF-8 string");
	return SINK_NIL;
}

static inline sink_val opi_utf8_str(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list");
		return SINK_NIL;
	}
	list_st ls = var_castlist(ctx, a);
	int tot = 0;
	for (int i = 0; i < ls.size; i++){
		sink_val b = ls.vals[i];
		if (!opihelp_codepoint(b)){
			opi_abortcstr(ctx, "Invalid list of codepoints");
			return SINK_NIL;
		}
		if (b.f < 0x80)
			tot++;
		else if (b.f < 0x800)
			tot += 2;
		else if (b.f < 0x10000)
			tot += 3;
		else
			tot += 4;
	}
	uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
	int pos = 0;
	for (int i = 0; i < ls.size; i++){
		int b = ls.vals[i].f;
		if (b < 0x80)
			bytes[pos++] = b;
		else if (b < 0x800){
			bytes[pos++] = 0xC0 | (b >> 6);
			bytes[pos++] = 0x80 | (b & 0x3F);
		}
		else if (b < 0x10000){
			bytes[pos++] = 0xE0 | (b >> 12);
			bytes[pos++] = 0x80 | ((b >> 6) & 0x3F);
			bytes[pos++] = 0x80 | (b & 0x3F);
		}
		else{
			bytes[pos++] = 0xF0 | (b >> 18);
			bytes[pos++] = 0x80 | ((b >> 12) & 0x3F);
			bytes[pos++] = 0x80 | ((b >> 6) & 0x3F);
			bytes[pos++] = 0x80 | (b & 0x3F);
		}
	}
	bytes[tot] = 0;
	return sink_str_newblobgive(ctx, tot, bytes);
}

static inline sink_val opi_struct_size(context ctx, sink_val a){
	if (!sink_islist(a))
		return SINK_NIL;
	list_st ls = var_castlist(ctx, a);
	int tot = 0;
	for (int i = 0; i < ls.size; i++){
		sink_val b = ls.vals[i];
		if (!sink_isnum(b))
			return SINK_NIL;
		struct_enum bi = (struct_enum)b.f;
		switch (bi){
			case STRUCT_U8  : tot += 1; break;
			case STRUCT_U16 : tot += 2; break;
			case STRUCT_UL16: tot += 2; break;
			case STRUCT_UB16: tot += 2; break;
			case STRUCT_U32 : tot += 4; break;
			case STRUCT_UL32: tot += 4; break;
			case STRUCT_UB32: tot += 4; break;
			case STRUCT_S8  : tot += 1; break;
			case STRUCT_S16 : tot += 2; break;
			case STRUCT_SL16: tot += 2; break;
			case STRUCT_SB16: tot += 2; break;
			case STRUCT_S32 : tot += 4; break;
			case STRUCT_SL32: tot += 4; break;
			case STRUCT_SB32: tot += 4; break;
			case STRUCT_F32 : tot += 4; break;
			case STRUCT_FL32: tot += 4; break;
			case STRUCT_FB32: tot += 4; break;
			case STRUCT_F64 : tot += 8; break;
			case STRUCT_FL64: tot += 8; break;
			case STRUCT_FB64: tot += 8; break;
			default:
				return SINK_NIL;
		}
	}
	return tot <= 0 ? SINK_NIL : sink_num(tot);
}

static inline sink_val opi_struct_str(context ctx, sink_val a, sink_val b){
	if (!sink_islist(a) || !sink_islist(b)){
		opi_abortcstr(ctx, "Expecting list");
		return SINK_NIL;
	}
	list_st data = var_castlist(ctx, a);
	list_st type = var_castlist(ctx, b);
	if (type.size <= 0)
		goto fail;
	if (data.size % type.size != 0)
		goto fail;
	for (int i = 0; i < data.size; i++){
		if (!sink_isnum(data.vals[i]))
			goto fail;
	}
	sink_val sizev = opi_struct_size(ctx, b);
	if (sink_isnil(sizev))
		goto fail;
	int arsize = data.size / type.size;
	int size = sizev.f * arsize;
	uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (size + 1));
	int pos = 0;
	for (int ar = 0; ar < arsize; ar++){
		for (int i = 0; i < type.size; i++){
			sink_val d = data.vals[i + ar * type.size];
			struct_enum bi = type.vals[i].f;
			switch (bi){
				case STRUCT_U8:
				case STRUCT_S8: {
					uint8_t v = d.f;
					bytes[pos++] = v;
				} break;
				case STRUCT_U16:
				case STRUCT_S16: {
					uint16_t v = d.f;
					uint8_t *vp = (uint8_t *)&v;
					bytes[pos++] = vp[0]; bytes[pos++] = vp[1];
				} break;
				case STRUCT_U32:
				case STRUCT_S32: {
					uint32_t v = d.f;
					uint8_t *vp = (uint8_t *)&v;
					bytes[pos++] = vp[0]; bytes[pos++] = vp[1];
					bytes[pos++] = vp[2]; bytes[pos++] = vp[3];
				} break;
				case STRUCT_F32: {
					float v = d.f;
					uint8_t *vp = (uint8_t *)&v;
					bytes[pos++] = vp[0]; bytes[pos++] = vp[1];
					bytes[pos++] = vp[2]; bytes[pos++] = vp[3];
				} break;
				case STRUCT_F64: {
					double v = d.f;
					uint8_t *vp = (uint8_t *)&v;
					bytes[pos++] = vp[0]; bytes[pos++] = vp[1];
					bytes[pos++] = vp[2]; bytes[pos++] = vp[3];
					bytes[pos++] = vp[4]; bytes[pos++] = vp[5];
					bytes[pos++] = vp[6]; bytes[pos++] = vp[7];
				} break;
				case STRUCT_UL16:
				case STRUCT_SL16: {
					uint16_t v = d.f;
					bytes[pos++] = (v      ) & 0xFF; bytes[pos++] = (v >>  8) & 0xFF;
				} break;
				case STRUCT_UB16:
				case STRUCT_SB16: {
					uint16_t v = d.f;
					bytes[pos++] = (v >>  8) & 0xFF; bytes[pos++] = (v      ) & 0xFF;
				} break;
				case STRUCT_UL32:
				case STRUCT_SL32: {
					uint32_t v = d.f;
					bytes[pos++] = (v      ) & 0xFF; bytes[pos++] = (v >>  8) & 0xFF;
					bytes[pos++] = (v >> 16) & 0xFF; bytes[pos++] = (v >> 24) & 0xFF;
				} break;
				case STRUCT_UB32:
				case STRUCT_SB32: {
					uint32_t v = d.f;
					bytes[pos++] = (v >> 24) & 0xFF; bytes[pos++] = (v >> 16) & 0xFF;
					bytes[pos++] = (v >>  8) & 0xFF; bytes[pos++] = (v      ) & 0xFF;
				} break;
				case STRUCT_FL32: {
					union { float f; uint32_t u; } v = { .f = d.f };
					bytes[pos++] = (v.u      ) & 0xFF; bytes[pos++] = (v.u >>  8) & 0xFF;
					bytes[pos++] = (v.u >> 16) & 0xFF; bytes[pos++] = (v.u >> 24) & 0xFF;
				} break;
				case STRUCT_FB32: {
					union { float f; uint32_t u; } v = { .f = d.f };
					bytes[pos++] = (v.u >> 24) & 0xFF; bytes[pos++] = (v.u >> 16) & 0xFF;
					bytes[pos++] = (v.u >>  8) & 0xFF; bytes[pos++] = (v.u      ) & 0xFF;
				} break;
				case STRUCT_FL64: {
					union { double f; uint64_t u; } v = { .f = d.f };
					bytes[pos++] = (v.u      ) & 0xFF; bytes[pos++] = (v.u >>  8) & 0xFF;
					bytes[pos++] = (v.u >> 16) & 0xFF; bytes[pos++] = (v.u >> 24) & 0xFF;
					bytes[pos++] = (v.u >> 32) & 0xFF; bytes[pos++] = (v.u >> 40) & 0xFF;
					bytes[pos++] = (v.u >> 48) & 0xFF; bytes[pos++] = (v.u >> 56) & 0xFF;
				} break;
				case STRUCT_FB64: {
					union { double f; uint64_t u; } v = { .f = d.f };
					bytes[pos++] = (v.u >> 56) & 0xFF; bytes[pos++] = (v.u >> 48) & 0xFF;
					bytes[pos++] = (v.u >> 40) & 0xFF; bytes[pos++] = (v.u >> 32) & 0xFF;
					bytes[pos++] = (v.u >> 24) & 0xFF; bytes[pos++] = (v.u >> 16) & 0xFF;
					bytes[pos++] = (v.u >>  8) & 0xFF; bytes[pos++] = (v.u      ) & 0xFF;
				} break;
			}
		}
	}
	bytes[size] = 0;
	return sink_str_newblobgive(ctx, size, bytes);
	fail:
	opi_abortcstr(ctx, "Invalid conversion");
	return SINK_NIL;
}

static inline sink_val opi_struct_list(context ctx, sink_val a, sink_val b){
	if (!sink_isstr(a)){
		opi_abortcstr(ctx, "Expecting string");
		return SINK_NIL;
	}
	if (!sink_islist(b)){
		opi_abortcstr(ctx, "Expecting list");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, a);
	sink_val stsizev = opi_struct_size(ctx, b);
	if (sink_isnil(stsizev))
		goto fail;
	int stsize = stsizev.f;
	if (s.size % stsize != 0)
		goto fail;
	list_st type = var_castlist(ctx, b);
	sink_val res = sink_list_newempty(ctx);
	int pos = 0;
	while (pos < s.size){
		for (int i = 0; i < type.size; i++){
			struct_enum bi = type.vals[i].f;
			switch (bi){
				case STRUCT_U8:
					sink_list_push(ctx, res, sink_num(s.bytes[pos++]));
					break;
				case STRUCT_S8:
					sink_list_push(ctx, res, sink_num((int8_t)s.bytes[pos++]));
					break;
				case STRUCT_U16: {
					uint16_t *v = (uint16_t *)&s.bytes[pos];
					sink_list_push(ctx, res, sink_num(*v));
					pos += 2;
				} break;
				case STRUCT_U32: {
					uint32_t *v = (uint32_t *)&s.bytes[pos];
					sink_list_push(ctx, res, sink_num(*v));
					pos += 4;
				} break;
				case STRUCT_S16: {
					int16_t *v = (int16_t *)&s.bytes[pos];
					sink_list_push(ctx, res, sink_num(*v));
					pos += 2;
				} break;
				case STRUCT_S32: {
					int32_t *v = (int32_t *)&s.bytes[pos];
					sink_list_push(ctx, res, sink_num(*v));
					pos += 4;
				} break;
				case STRUCT_F32: {
					float *v = (float *)&s.bytes[pos];
					sink_list_push(ctx, res, sink_num(*v));
					pos += 4;
				} break;
				case STRUCT_F64: {
					double *v = (double *)&s.bytes[pos];
					sink_list_push(ctx, res, sink_num(*v));
					pos += 8;
				} break;
				case STRUCT_UL16: {
					uint16_t v = 0;
					v |= s.bytes[pos++];
					v |= ((uint16_t)s.bytes[pos++]) << 8;
					sink_list_push(ctx, res, sink_num(v));
				} break;
				case STRUCT_UB16: {
					uint16_t v = 0;
					v |= ((uint16_t)s.bytes[pos++]) << 8;
					v |= s.bytes[pos++];
					sink_list_push(ctx, res, sink_num(v));
				} break;
				case STRUCT_UL32: {
					uint32_t v = 0;
					v |= s.bytes[pos++];
					v |= ((uint32_t)s.bytes[pos++]) <<  8;
					v |= ((uint32_t)s.bytes[pos++]) << 16;
					v |= ((uint32_t)s.bytes[pos++]) << 24;
					sink_list_push(ctx, res, sink_num(v));
				} break;
				case STRUCT_UB32: {
					uint32_t v = 0;
					v |= ((uint32_t)s.bytes[pos++]) << 24;
					v |= ((uint32_t)s.bytes[pos++]) << 16;
					v |= ((uint32_t)s.bytes[pos++]) <<  8;
					v |= s.bytes[pos++];
					sink_list_push(ctx, res, sink_num(v));
				} break;
				case STRUCT_SL16: {
					uint16_t v = 0;
					v |= s.bytes[pos++];
					v |= ((uint16_t)s.bytes[pos++]) << 8;
					sink_list_push(ctx, res, sink_num((int16_t)v));
				} break;
				case STRUCT_SB16: {
					uint16_t v = 0;
					v |= ((uint16_t)s.bytes[pos++]) << 8;
					v |= s.bytes[pos++];
					sink_list_push(ctx, res, sink_num((int16_t)v));
				} break;
				case STRUCT_SL32: {
					uint32_t v = 0;
					v |= s.bytes[pos++];
					v |= ((uint32_t)s.bytes[pos++]) <<  8;
					v |= ((uint32_t)s.bytes[pos++]) << 16;
					v |= ((uint32_t)s.bytes[pos++]) << 24;
					sink_list_push(ctx, res, sink_num((int32_t)v));
				} break;
				case STRUCT_SB32: {
					uint32_t v = 0;
					v |= ((uint32_t)s.bytes[pos++]) << 24;
					v |= ((uint32_t)s.bytes[pos++]) << 16;
					v |= ((uint32_t)s.bytes[pos++]) <<  8;
					v |= s.bytes[pos++];
					sink_list_push(ctx, res, sink_num((int32_t)v));
				} break;
				case STRUCT_FL32: {
					union { float f; uint32_t u; } v = { .u = 0 };
					v.u |= s.bytes[pos++];
					v.u |= ((uint32_t)s.bytes[pos++]) <<  8;
					v.u |= ((uint32_t)s.bytes[pos++]) << 16;
					v.u |= ((uint32_t)s.bytes[pos++]) << 24;
					if (isnan(v.f))
						sink_list_push(ctx, res, sink_num_nan());
					else
						sink_list_push(ctx, res, sink_num(v.f));
				} break;
				case STRUCT_FB32: {
					union { float f; uint32_t u; } v = { .u = 0 };
					v.u |= ((uint32_t)s.bytes[pos++]) << 24;
					v.u |= ((uint32_t)s.bytes[pos++]) << 16;
					v.u |= ((uint32_t)s.bytes[pos++]) <<  8;
					v.u |= s.bytes[pos++];
					if (isnan(v.f))
						sink_list_push(ctx, res, sink_num_nan());
					else
						sink_list_push(ctx, res, sink_num(v.f));
				} break;
				case STRUCT_FL64: {
					union { double f; uint64_t u; } v = { .u = 0 };
					v.u |= s.bytes[pos++];
					v.u |= ((uint64_t)s.bytes[pos++]) <<  8;
					v.u |= ((uint64_t)s.bytes[pos++]) << 16;
					v.u |= ((uint64_t)s.bytes[pos++]) << 24;
					v.u |= ((uint64_t)s.bytes[pos++]) << 32;
					v.u |= ((uint64_t)s.bytes[pos++]) << 40;
					v.u |= ((uint64_t)s.bytes[pos++]) << 48;
					v.u |= ((uint64_t)s.bytes[pos++]) << 56;
					if (isnan(v.f))
						sink_list_push(ctx, res, sink_num_nan());
					else
						sink_list_push(ctx, res, sink_num(v.f));
				} break;
				case STRUCT_FB64: {
					union { double f; uint64_t u; } v = { .u = 0 };
					v.u |= ((uint64_t)s.bytes[pos++]) << 56;
					v.u |= ((uint64_t)s.bytes[pos++]) << 48;
					v.u |= ((uint64_t)s.bytes[pos++]) << 40;
					v.u |= ((uint64_t)s.bytes[pos++]) << 32;
					v.u |= ((uint64_t)s.bytes[pos++]) << 24;
					v.u |= ((uint64_t)s.bytes[pos++]) << 16;
					v.u |= ((uint64_t)s.bytes[pos++]) <<  8;
					v.u |= s.bytes[pos++];
					if (isnan(v.f))
						sink_list_push(ctx, res, sink_num_nan());
					else
						sink_list_push(ctx, res, sink_num(v.f));
				} break;
			}
		}
	}
	return res;
	fail:
	opi_abortcstr(ctx, "Invalid conversion");
	return SINK_NIL;
}

static inline bool opi_struct_isLE(){
	union {
		uint16_t a;
		uint8_t b[2];
	} v;
	v.a = 0x1234;
	return v.b[0] == 0x34;
}

// operators
static sink_val unop_num_neg(context ctx, sink_val a){
	return sink_num(-a.f);
}

static sink_val unop_tonum(context ctx, sink_val a){
	if (sink_isnum(a))
		return a;
	if (!sink_isstr(a))
		return SINK_NIL;
	str_st s = var_caststr(ctx, a);

	numpart_info npi;
	numpart_new(&npi);
	enum {
		TONUM_START,
		TONUM_NEG,
		TONUM_0,
		TONUM_2,
		TONUM_BODY,
		TONUM_FRAC,
		TONUM_EXP,
		TONUM_EXP_BODY
	} state = TONUM_START;
	bool hasval = false;
	for (int i = 0; i < s.size; i++){
		char ch = (char)s.bytes[i];
		switch (state){
			case TONUM_START:
				if (isNum(ch)){
					hasval = true;
					npi.val = toHex(ch);
					if (npi.val == 0)
						state = TONUM_0;
					else
						state = TONUM_BODY;
				}
				else if (ch == '-'){
					npi.sign = -1;
					state = TONUM_NEG;
				}
				else if (ch == '.')
					state = TONUM_FRAC;
				else if (!isSpace(ch))
					return SINK_NIL;
				break;

			case TONUM_NEG:
				if (isNum(ch)){
					hasval = true;
					npi.val = toHex(ch);
					if (npi.val == 0)
						state = TONUM_0;
					else
						state = TONUM_BODY;
				}
				else if (ch == '.')
					state = TONUM_FRAC;
				else
					return SINK_NIL;
				break;

			case TONUM_0:
				if (ch == 'b'){
					npi.base = 2;
					state = TONUM_2;
				}
				else if (ch == 'c'){
					npi.base = 8;
					state = TONUM_2;
				}
				else if (ch == 'x'){
					npi.base = 16;
					state = TONUM_2;
				}
				else if (ch == '_')
					state = TONUM_BODY;
				else if (ch == '.')
					state = TONUM_FRAC;
				else if (ch == 'e' || ch == 'E')
					state = TONUM_EXP;
				else if (isNum(ch)){
					// number has a leading zero, so just ignore it
					// (not valid in sink, but valid at runtime for flexibility)
					npi.val = toHex(ch);
					state = TONUM_BODY;
				}
				else
					return sink_num(0);
				break;

			case TONUM_2:
				if (isHex(ch)){
					npi.val = toHex(ch);
					if (npi.val >= npi.base)
						return sink_num(0);
					state = TONUM_BODY;
				}
				else if (ch != '_')
					return sink_num(0);
				break;

			case TONUM_BODY:
				if (ch == '.')
					state = TONUM_FRAC;
				else if ((npi.base == 10 && (ch == 'e' || ch == 'E')) ||
					(npi.base != 10 && (ch == 'p' || ch == 'P')))
					state = TONUM_EXP;
				else if (isHex(ch)){
					int v = toHex(ch);
					if (v >= npi.base)
						return sink_num(numpart_calc(npi));
					else
						npi.val = npi.val * npi.base + v;
				}
				else if (ch != '_')
					return sink_num(numpart_calc(npi));
				break;

			case TONUM_FRAC:
				if (hasval && ((npi.base == 10 && (ch == 'e' || ch == 'E')) ||
					(npi.base != 10 && (ch == 'p' || ch == 'P'))))
					state = TONUM_EXP;
				else if (isHex(ch)){
					hasval = true;
					int v = toHex(ch);
					if (v >= npi.base)
						return sink_num(numpart_calc(npi));
					npi.frac = npi.frac * npi.base + v;
					npi.flen++;
				}
				else if (ch != '_')
					return sink_num(numpart_calc(npi));
				break;

			case TONUM_EXP:
				if (ch != '_'){
					npi.esign = ch == '-' ? -1 : 1;
					state = TONUM_EXP_BODY;
					if (ch != '+' && ch != '-')
						i--;
				}
				break;

			case TONUM_EXP_BODY:
				if (isNum(ch))
					npi.eval = npi.eval * 10.0 + toHex(ch);
				else if (ch != '_')
					return sink_num(numpart_calc(npi));
				break;
		}
	}
	if (state == TONUM_START || state == TONUM_NEG || (state == TONUM_FRAC && !hasval))
		return SINK_NIL;
	return sink_num(numpart_calc(npi));
}

static sink_val unop_num_abs(context ctx, sink_val a){
	return sink_num(fabs(a.f));
}

static sink_val unop_num_sign(context ctx, sink_val a){
	return isnan(a.f) ? SINK_NAN : sink_num(a.f < 0 ? -1 : (a.f > 0 ? 1 : 0));
}

static sink_val unop_num_floor(context ctx, sink_val a){
	return sink_num(floor(a.f));
}

static sink_val unop_num_ceil(context ctx, sink_val a){
	return sink_num(ceil(a.f));
}

static sink_val unop_num_round(context ctx, sink_val a){
	return sink_num(round(a.f));
}

static sink_val unop_num_trunc(context ctx, sink_val a){
	return sink_num(trunc(a.f));
}

static sink_val unop_num_isnan(context ctx, sink_val a){
	return sink_bool(sink_num_isnan(a));
}

static sink_val unop_num_isfinite(context ctx, sink_val a){
	return sink_bool(sink_num_isfinite(a));
}

static sink_val unop_num_sin(context ctx, sink_val a){
	return sink_num(sin(a.f));
}

static sink_val unop_num_cos(context ctx, sink_val a){
	return sink_num(cos(a.f));
}

static sink_val unop_num_tan(context ctx, sink_val a){
	return sink_num(tan(a.f));
}

static sink_val unop_num_asin(context ctx, sink_val a){
	return sink_num(asin(a.f));
}

static sink_val unop_num_acos(context ctx, sink_val a){
	return sink_num(acos(a.f));
}

static sink_val unop_num_atan(context ctx, sink_val a){
	return sink_num(atan(a.f));
}

static sink_val unop_num_log(context ctx, sink_val a){
	return sink_num(log(a.f));
}

static sink_val unop_num_log2(context ctx, sink_val a){
	return sink_num(log2(a.f));
}

static sink_val unop_num_log10(context ctx, sink_val a){
	return sink_num(log10(a.f));
}

static sink_val unop_num_exp(context ctx, sink_val a){
	return sink_num(exp(a.f));
}

static sink_val binop_num_add(context ctx, sink_val a, sink_val b){
	return sink_num(a.f + b.f);
}

static sink_val binop_num_sub(context ctx, sink_val a, sink_val b){
	return sink_num(a.f - b.f);
}

static sink_val binop_num_mul(context ctx, sink_val a, sink_val b){
	return sink_num(a.f * b.f);
}

static sink_val binop_num_div(context ctx, sink_val a, sink_val b){
	return sink_num(a.f / b.f);
}

static sink_val binop_num_mod(context ctx, sink_val a, sink_val b){
	return sink_num(fmod(a.f, b.f));
}

static sink_val binop_num_pow(context ctx, sink_val a, sink_val b){
	return sink_num(pow(a.f, b.f));
}

static sink_val binop_num_atan2(context ctx, sink_val a, sink_val b){
	return sink_num(atan2(a.f, b.f));
}

static sink_val binop_num_hex(context ctx, sink_val a, sink_val b){
	return isnan(a.f) ? SINK_NAN : opi_num_base(ctx, a.f, sink_isnil(b) ? 0 : b.f, 16);
}

static sink_val binop_num_oct(context ctx, sink_val a, sink_val b){
	return isnan(a.f) ? SINK_NAN : opi_num_base(ctx, a.f, sink_isnil(b) ? 0 : b.f, 8);
}

static sink_val binop_num_bin(context ctx, sink_val a, sink_val b){
	return isnan(a.f) ? SINK_NAN : opi_num_base(ctx, a.f, sink_isnil(b) ? 0 : b.f, 2);
}

static sink_val triop_num_clamp(context ctx, sink_val a, sink_val b, sink_val c){
	return isnan(a.f) || isnan(b.f) || isnan(c.f) ? SINK_NAN :
		sink_num(a.f < b.f ? b.f : (a.f > c.f ? c.f : a.f));
}

static sink_val triop_num_lerp(context ctx, sink_val a, sink_val b, sink_val c){
	return sink_num(a.f + (b.f - a.f) * c.f);
}

static inline int32_t toint(sink_val v){
	return (int32_t)(uint32_t)v.f;
}

static inline sink_val intnum(int32_t v){
	return sink_num(v);
}

static sink_val unop_int_new(context ctx, sink_val a){
	return intnum(toint(a));
}

static sink_val unop_int_not(context ctx, sink_val a){
	return intnum(~toint(a));
}

static sink_val unop_int_clz(context ctx, sink_val a){
	#if defined(__has_builtin) && __has_builtin(__builtin_clz)
		int32_t i = toint(a);
		if (i == 0)
			return sink_num(32);
		return sink_num(__builtin_clz(i));
	#elif defined(BITSCAN_FFSLL)
		return sink_num(32 - fls(toint(a)));
	#elif defined(BITSCAN_WIN)
		int i = toint(a);
		if (i == 0)
			return sink_num(32);
		unsigned long pos;
		_BitScanReverse(&pos, i);
		return sink_num(31 - pos);
	#else
	#	error Don't know how to implement bmp_alloc
	#endif
}

static sink_val unop_int_pop(context ctx, sink_val a){
	uint32_t n = toint(a);
	n = ((n & 0xAAAAAAAA) >>  1) + (n & 0x55555555);
	n = ((n & 0xCCCCCCCC) >>  2) + (n & 0x33333333);
	n = ((n & 0xF0F0F0F0) >>  4) + (n & 0x0F0F0F0F);
	n = ((n & 0xFF00FF00) >>  8) + (n & 0x00FF00FF);
	n = ((n & 0xFFFF0000) >> 16) + (n & 0x0000FFFF);
	return intnum(n);
}

static sink_val unop_int_bswap(context ctx, sink_val a){
	uint32_t n = toint(a);
	n = (n >> 24) | ((n >> 8) & 0xFF00) | ((n << 8) & 0xFF0000) | (n << 24);
	return intnum(n);
}

static sink_val binop_int_and(context ctx, sink_val a, sink_val b){
	return intnum(toint(a) & toint(b));
}

static sink_val binop_int_or(context ctx, sink_val a, sink_val b){
	return intnum(toint(a) | toint(b));
}

static sink_val binop_int_xor(context ctx, sink_val a, sink_val b){
	return intnum(toint(a) ^ toint(b));
}

static sink_val binop_int_shl(context ctx, sink_val a, sink_val b){
	return intnum(toint(a) << toint(b));
}

static sink_val binop_int_shr(context ctx, sink_val a, sink_val b){
	return intnum(((uint32_t)toint(a)) >> toint(b));
}

static sink_val binop_int_sar(context ctx, sink_val a, sink_val b){
	return intnum(toint(a) >> toint(b));
}

static sink_val binop_int_add(context ctx, sink_val a, sink_val b){
	return intnum(toint(a) + toint(b));
}

static sink_val binop_int_sub(context ctx, sink_val a, sink_val b){
	return intnum(toint(a) - toint(b));
}

static sink_val binop_int_mul(context ctx, sink_val a, sink_val b){
	return intnum(toint(a) * toint(b));
}

static sink_val binop_int_div(context ctx, sink_val a, sink_val b){
	int32_t i = toint(b);
	if (i == 0)
		return intnum(0);
	return intnum(toint(a) / i);
}

static sink_val binop_int_mod(context ctx, sink_val a, sink_val b){
	int32_t i = toint(b);
	if (i == 0)
		return intnum(0);
	return intnum(toint(a) % i);
}

// inline operators
static inline bool opi_equ(context ctx, sink_val a, sink_val b){
	if (a.u == b.u){
		if (sink_isnum(a))
			return a.f == b.f;
		return true;
	}
	if (sink_isstr(a) && sink_isstr(b))
		return str_cmp(var_caststr(ctx, a), var_caststr(ctx, b)) == 0;
	return false;
}

static inline int opi_size(context ctx, sink_val a){
	if (sink_islist(a)){
		list_st ls = var_castlist(ctx, a);
		return ls.size;
	}
	else if (sink_isstr(a)){
		str_st str = var_caststr(ctx, a);
		return str.size;
	}
	opi_abortcstr(ctx, "Expecting string or list for size");
	return 0;
}

static inline sink_val opi_tonum(context ctx, sink_val a){
	if (!oper_typelist(ctx, a, LT_ALLOWNIL | LT_ALLOWNUM | LT_ALLOWSTR)){
		opi_abortcstr(ctx, "Expecting string when converting to number");
		return SINK_NIL;
	}
	return oper_un(ctx, a, unop_tonum);
}

static inline sink_wait opi_say(context ctx, int size, sink_val *vals){
	if (ctx->io.f_say){
		return ctx->io.f_say(
			ctx,
			sink_caststr(ctx, sink_list_joinplain(ctx, size, vals, 1, (const uint8_t *)" ")),
			ctx->io.user
		);
	}
	return sink_done(ctx, SINK_NIL);
}

static inline sink_wait opi_warn(context ctx, int size, sink_val *vals){
	if (ctx->io.f_warn){
		return ctx->io.f_warn(
			ctx,
			sink_caststr(ctx, sink_list_joinplain(ctx, size, vals, 1, (const uint8_t *)" ")),
			ctx->io.user
		);
	}
	return sink_done(ctx, SINK_NIL);
}

static inline sink_wait opi_ask(context ctx, int size, sink_val *vals){
	if (ctx->io.f_ask){
		return ctx->io.f_ask(
			ctx,
			sink_caststr(ctx, sink_list_joinplain(ctx, size, vals, 1, (const uint8_t *)" ")),
			ctx->io.user
		);
	}
	return sink_done(ctx, SINK_NIL);
}

static inline sink_run opi_exit(context ctx){
	ctx->passed = true;
	return SINK_RUN_PASS;
}

static inline filepos_st callstack_flp(context ctx, int pc){
	filepos_st flp = FILEPOS_NULL;
	int i = 0;
	for ( ; i < ctx->prg->posTable->size; i++){
		prgflp p = ctx->prg->posTable->ptrs[i];
		if (p->pc > pc){
			if (i > 0)
				flp = ((prgflp)ctx->prg->posTable->ptrs[i - 1])->flp;
			break;
		}
	}
	if (i > 0 && i == ctx->prg->posTable->size)
		flp = ((prgflp)ctx->prg->posTable->ptrs[i - 1])->flp;
	return flp;
}

static inline int callstack_cmdhint(context ctx, int pc){
	for (int i = 0; i < ctx->prg->cmdTable->size; i++){
		prgch p = ctx->prg->cmdTable->ptrs[i];
		if (p->pc > pc){
			// start working backwards
			int nest = 0;
			for (int j = i - 1; j >= 0; j--){
				p = ctx->prg->cmdTable->ptrs[j];
				if (p->cmdhint < 0)
					nest++;
				else{
					nest--;
					if (nest < 0)
						return p->cmdhint;
				}
			}
			break;
		}
	}
	return -1;
}

static char *callstack_append(context ctx, char *err, int pc){
	filepos_st flp = callstack_flp(ctx, pc);
	int cmdhint = callstack_cmdhint(ctx, pc);
	const char *chn = NULL;
	if (cmdhint >= 0)
		chn = program_getdebugstr(ctx->prg, cmdhint);
	if (flp.line >= 0){
		char *err2 = program_errormsg(ctx->prg, flp, NULL);
		char *err3;
		if (chn){
			if (err)
				err3 = format("%s\n    at %s (%s)", err, chn, err2);
			else
				err3 = format("%s (%s)", chn, err2);
		}
		else{
			if (err)
				err3 = format("%s\n    at %s", err, err2);
			else{
				err3 = err2;
				err2 = NULL;
			}
		}
		if (err2)
			mem_free(err2);
		if (err)
			mem_free(err);
		return err3;
	}
	else if (chn){
		char *err2;
		if (err){
			err2 = format("%s\n    at %s", err, chn);
			mem_free(err);
		}
		else
			err2 = format("%s", chn);
		return err2;
	}
	return err;
}

static inline sink_run opi_abort(context ctx, char *err){
	ctx->failed = true;
	if (err == NULL)
		return SINK_RUN_FAIL;
	err = callstack_append(ctx, err, ctx->lastpc);
	for (int i = ctx->call_stk->size - 1, j = 0; i >= 0 && j < 9; i--, j++){
		ccs here = ctx->call_stk->ptrs[i];
		err = callstack_append(ctx, err, here->pc - 1);
	}
	if (ctx->err)
		mem_free(ctx->err);
	ctx->err = format("Error: %s", err);
	mem_free(err);
	return SINK_RUN_FAIL;
}

static inline sink_val opi_stacktrace(context ctx){
	sink_val ls = sink_list_newempty(ctx);
	char *err = callstack_append(ctx, NULL, ctx->lastpc);
	if (err)
		sink_list_push(ctx, ls, sink_str_newcstrgive(ctx, err));
	for (int i = ctx->call_stk->size - 1; i >= 0; i--){
		ccs here = ctx->call_stk->ptrs[i];
		err = callstack_append(ctx, NULL, here->pc - 1);
		if (err)
			sink_list_push(ctx, ls, sink_str_newcstrgive(ctx, err));
	}
	return ls;
}

static inline sink_run opi_abortcstr(context ctx, const char *msg){
	return opi_abort(ctx, format("%s", msg));
}

static inline sink_val opi_abortformat(context ctx, const char *fmt, ...){
	va_list args, args2;
	va_start(args, fmt);
	va_copy(args2, args);
	size_t s = vsnprintf(NULL, 0, fmt, args);
	char *buf = mem_alloc(s + 1);
	vsprintf_s(buf, s + 1, fmt, args2);
	va_end(args);
	va_end(args2);
	opi_abort(ctx, buf);
	return SINK_NIL;
}

static inline sink_val opi_unop(context ctx, sink_val a, unary_f f_unary, const char *erop){
	if (!oper_typelist(ctx, a, LT_ALLOWNUM))
		return opi_abortformat(ctx, "Expecting number or list of numbers when %s", erop);
	return oper_un(ctx, a, f_unary);
}

static inline sink_val opi_binop(context ctx, sink_val a, sink_val b, binary_f f_binary,
	const char *erop, int t1, int t2){
	if (!oper_typelist(ctx, a, t1))
		return opi_abortformat(ctx, "Expecting number or list of numbers when %s", erop);
	if (!oper_typelist(ctx, b, t2))
		return opi_abortformat(ctx, "Expecting number or list of numbers when %s", erop);
	return oper_bin(ctx, a, b, f_binary);
}

static inline sink_val opi_triop(context ctx, sink_val a, sink_val b, sink_val c,
	trinary_f f_trinary, const char *erop){
	if (!oper_typelist(ctx, a, LT_ALLOWNUM))
		return opi_abortformat(ctx, "Expecting number or list of numbers when %s", erop);
	if (!oper_typelist(ctx, b, LT_ALLOWNUM))
		return opi_abortformat(ctx, "Expecting number or list of numbers when %s", erop);
	if (!oper_typelist(ctx, c, LT_ALLOWNUM))
		return opi_abortformat(ctx, "Expecting number or list of numbers when %s", erop);
	return oper_tri(ctx, a, b, c, f_trinary);
}

static inline sink_val opi_combop(context ctx, int size, sink_val *vals, binary_f f_binary,
	const char *erop){
	if (size <= 0)
		goto badtype;
	int listsize = -1;
	for (int i = 0; i < size; i++){
		if (sink_islist(vals[i])){
			list_st ls = var_castlist(ctx, vals[i]);
			if (ls.size > listsize)
				listsize = ls.size;
			for (int j = 0; j < ls.size; j++){
				if (!sink_isnum(ls.vals[j]))
					goto badtype;
			}
		}
		else if (!sink_isnum(vals[i]))
			goto badtype;
	}

	if (listsize < 0){
		// no lists, so just combine
		for (int i = 1; i < size; i++)
			vals[0] = f_binary(ctx, vals[0], vals[i]);
		return vals[0];
	}
	else if (listsize > 0){
		sink_val *ret = mem_alloc(sizeof(sink_val) * listsize);
		for (int j = 0; j < listsize; j++)
			ret[j] = arget(ctx, vals[0], j);
		for (int i = 1; i < size; i++){
			for (int j = 0; j < listsize; j++)
				ret[j] = f_binary(ctx, ret[j], arget(ctx, vals[i], j));
		}
		return sink_list_newblobgive(ctx, listsize, listsize, ret);
	}
	// otherwise, listsize == 0
	return sink_list_newempty(ctx);

	badtype:
	return opi_abortformat(ctx, "Expecting number or list of numbers when %s", erop);
}

static inline sink_val opi_str_cat(context ctx, int argcount, const sink_val *args){
	return sink_list_joinplain(ctx, argcount, args, 0, NULL);
}

typedef struct {
	int start;
	int len;
} fix_slice_st;

static inline fix_slice_st fix_slice(sink_val startv, sink_val lenv, int objsize){
	int start = (int)round(startv.f);
	if (sink_isnil(lenv)){
		if (start < 0)
			start += objsize;
		if (start < 0)
			start = 0;
		if (start >= objsize)
			return (fix_slice_st){ 0, 0 };
		return (fix_slice_st){ start, objsize - start };
	}
	else{
		int len = (int)round(lenv.f);
		bool wasneg = start < 0;
		if (len < 0){
			wasneg = start <= 0;
			start += len;
			len = -len;
		}
		if (wasneg)
			start += objsize;
		if (start < 0){
			len += start;
			start = 0;
		}
		if (len <= 0)
			return (fix_slice_st){ 0, 0 };
		if (start + len > objsize)
			len = objsize - start;
		return (fix_slice_st){ start, len };
	}
}

static inline sink_val opi_str_slice(context ctx, sink_val a, sink_val b, sink_val c){
	if (!sink_isstr(a)){
		opi_abortcstr(ctx, "Expecting list or string when slicing");
		return SINK_NIL;
	}
	if (!sink_isnum(b) || (!sink_isnil(c) && !sink_isnum(c))){
		opi_abortcstr(ctx, "Expecting slice values to be numbers");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, a);
	if (s.size <= 0)
		return a;
	fix_slice_st sl = fix_slice(b, c, s.size);
	if (sl.len <= 0)
		return sink_str_newblob(ctx, 0, NULL);
	return sink_str_newblob(ctx, sl.len, &s.bytes[sl.start]);
}

static inline sink_val opi_str_splice(context ctx, sink_val a, sink_val b, sink_val c, sink_val d){
	if (!sink_isstr(a)){
		opi_abortcstr(ctx, "Expecting list or string when splicing");
		return SINK_NIL;
	}
	if (!sink_isnum(b) || (!sink_isnil(c) && !sink_isnum(c))){
		opi_abortcstr(ctx, "Expecting splice values to be numbers");
		return SINK_NIL;
	}
	if (!sink_isnil(d) && !sink_isstr(d)){
		opi_abortcstr(ctx, "Expecting spliced value to be a string");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, a);
	fix_slice_st sl = fix_slice(b, c, s.size);
	if (sink_isnil(d)){
		if (sl.len <= 0)
			return a;
		int tot = s.size - sl.len;
		if (tot <= 0)
			return sink_str_newblob(ctx, 0, NULL);
		uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
		if (sl.start > 0)
			memcpy(bytes, s.bytes, sizeof(uint8_t) * sl.start);
		if (s.size > sl.start + sl.len){
			memcpy(&bytes[sl.start], &s.bytes[sl.start + sl.len],
				sizeof(uint8_t) * (s.size - sl.start - sl.len));
		}
		bytes[tot] = 0;
		return sink_str_newblobgive(ctx, tot, bytes);
	}
	else{
		str_st s2 = var_caststr(ctx, d);
		int tot = s.size - sl.len + s2.size;
		if (tot <= 0)
			return sink_str_newblob(ctx, 0, NULL);
		uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
		if (sl.start > 0)
			memcpy(bytes, s.bytes, sizeof(uint8_t) * sl.start);
		if (s2.size > 0)
			memcpy(&bytes[sl.start], s2.bytes, sizeof(uint8_t) * s2.size);
		if (s.size > sl.start + sl.len){
			memcpy(&bytes[sl.start + s2.size], &s.bytes[sl.start + sl.len],
				sizeof(uint8_t) * (s.size - sl.start - sl.len));
		}
		bytes[tot] = 0;
		return sink_str_newblobgive(ctx, tot, bytes);
	}
}

static const int sink_list_grow = 200;
static inline sink_val opi_list_new(context ctx, sink_val a, sink_val b){
	if (!sink_isnil(a) && !sink_isnum(a)){
		opi_abortcstr(ctx, "Expecting number for list.new");
		return SINK_NIL;
	}
	int size = sink_isnil(a) ? 0 : a.f;
	if (size <= 0)
		return sink_list_newempty(ctx);
	int count = size < sink_list_grow ? sink_list_grow : size;
	sink_val *vals = mem_alloc(sizeof(sink_val) * count);
	for (int i = 0; i < size; i++)
		vals[i] = b;
	return sink_list_newblobgive(ctx, size, count, vals);
}

static inline sink_val opi_list_cat(context ctx, int argcount, sink_val *args){
	int ns = 0;
	for (int i = 0; i < argcount; i++)
		ns += var_castlist(ctx, args[i]).size;
	if (ns <= 0)
		return sink_list_newempty(ctx);
	sink_val *vals = mem_alloc(sizeof(sink_val) * ns);
	ns = 0;
	for (int i = 0; i < argcount; i++){
		list_st ls = var_castlist(ctx, args[i]);
		if (ls.size > 0){
			memcpy(&vals[ns], ls.vals, sizeof(sink_val) * ls.size);
			ns += ls.size;
		}
	}
	return sink_list_newblobgive(ctx, ns, ns, vals);
}

static inline sink_val opi_list_slice(context ctx, sink_val a, sink_val b, sink_val c){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list or string when slicing");
		return SINK_NIL;
	}
	if (!sink_isnum(b) || (!sink_isnil(c) && !sink_isnum(c))){
		opi_abortcstr(ctx, "Expecting slice values to be numbers");
		return SINK_NIL;
	}
	list_st ls = var_castlist(ctx, a);
	fix_slice_st sl = fix_slice(b, c, ls.size);
	if (ls.size <= 0 || sl.len <= 0)
		return sink_list_newempty(ctx);
	return sink_list_newblob(ctx, sl.len, &ls.vals[sl.start]);
}

static inline void opi_list_splice(context ctx, sink_val a, sink_val b, sink_val c, sink_val d){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list or string when splicing");
		return;
	}
	if (!sink_isnum(b) || (!sink_isnil(c) && !sink_isnum(c))){
		opi_abortcstr(ctx, "Expecting splice values to be numbers");
		return;
	}
	if (!sink_isnil(d) && !sink_islist(d)){
		opi_abortcstr(ctx, "Expecting spliced value to be a list");
		return;
	}
	list_st *ls = var_castmlist(ctx, a);
	fix_slice_st sl = fix_slice(b, c, ls->size);
	if (sink_isnil(d)){
		if (sl.len <= 0)
			return;
		if (ls->size > sl.start + sl.len){
			memmove(&ls->vals[sl.start], &ls->vals[sl.start + sl.len],
				sizeof(sink_val) * (ls->size - sl.start - sl.len));
		}
		ls->size -= sl.len;
	}
	else{
		list_st ls2 = var_castlist(ctx, d);
		if (sl.len <= 0 && ls2.size <= 0)
			return;
		int tot = ls->size - sl.len + ls2.size;
		if (tot > ls->count){
			ls->vals = mem_realloc(ls->vals, sizeof(sink_val) * tot);
			ls->count = tot;
		}
		if (ls->size > sl.start + sl.len){
			memmove(&ls->vals[sl.start + ls2.size], &ls->vals[sl.start + sl.len],
				sizeof(sink_val) * (ls->size - sl.start - sl.len));
		}
		if (ls2.size > 0)
			memcpy(&ls->vals[sl.start], ls2.vals, sizeof(sink_val) * ls2.size);
		ls->size = tot;
	}
}

static inline sink_val opi_list_shift(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list when shifting");
		return SINK_NIL;
	}
	list_st *ls = var_castmlist(ctx, a);
	if (ls->size <= 0)
		return SINK_NIL;
	sink_val ret = ls->vals[0];
	if (ls->size <= 1)
		ls->size = 0;
	else{
		ls->size--;
		memcpy(&ls->vals[0], &ls->vals[1], sizeof(sink_val) * ls->size);
	}
	return ret;
}

static inline sink_val opi_list_pop(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list when popping");
		return SINK_NIL;
	}
	list_st *ls = var_castmlist(ctx, a);
	if (ls->size <= 0)
		return SINK_NIL;
	ls->size--;
	return ls->vals[ls->size];
}

static inline sink_val opi_list_push(context ctx, sink_val a, sink_val b){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list when pushing");
		return SINK_NIL;
	}
	list_st *ls = var_castmlist(ctx, a);
	if (ls->size >= ls->count){
		ls->count += sink_list_grow;
		ls->vals = mem_realloc(ls->vals, sizeof(sink_val) * ls->count);
	}
	ls->vals[ls->size++] = b;
	return a;
}

static inline void opi_list_pushnils(context ctx, list_st *ls, int totalsize){
	if (ls->size >= totalsize)
		return;
	if (totalsize > ls->count){
		ls->count = totalsize + sink_list_grow;
		ls->vals = mem_realloc(ls->vals, sizeof(sink_val) * ls->count);
	}
	while (ls->size < totalsize)
		ls->vals[ls->size++] = SINK_NIL;
}

static inline sink_val opi_list_unshift(context ctx, sink_val a, sink_val b){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list when unshifting");
		return SINK_NIL;
	}
	list_st *ls = var_castmlist(ctx, a);
	if (ls->size >= ls->count){
		ls->count += sink_list_grow;
		ls->vals = mem_realloc(ls->vals, sizeof(sink_val) * ls->count);
	}
	if (ls->size > 0)
		memmove(&ls->vals[1], ls->vals, sizeof(sink_val) * ls->size);
	ls->vals[0] = b;
	ls->size++;
	return a;
}

static inline sink_val opi_list_append(context ctx, sink_val a, sink_val b){
	if (!sink_islist(a) || !sink_islist(b)){
		opi_abortcstr(ctx, "Expecting list when appending");
		return SINK_NIL;
	}
	list_st ls2 = var_castlist(ctx, b);
	if (ls2.size > 0){
		list_st *ls = var_castmlist(ctx, a);
		if (ls->size + ls2.size >= ls->count){
			ls->count = ls->size + ls2.size + sink_list_grow;
			ls->vals = mem_realloc(ls->vals, sizeof(sink_val) * ls->count);
		}
		memcpy(&ls->vals[ls->size], ls2.vals, sizeof(sink_val) * ls2.size);
		ls->size += ls2.size;
	}
	return a;
}

static inline sink_val opi_list_prepend(context ctx, sink_val a, sink_val b){
	if (!sink_islist(a) || !sink_islist(b)){
		opi_abortcstr(ctx, "Expecting list when prepending");
		return SINK_NIL;
	}
	list_st ls2 = var_castlist(ctx, b);
	if (ls2.size > 0){
		list_st *ls = var_castmlist(ctx, a);
		if (ls->size + ls2.size >= ls->count){
			ls->count = ls->size + ls2.size + sink_list_grow;
			ls->vals = mem_realloc(ls->vals, sizeof(sink_val) * ls->count);
		}
		if (ls->size > 0)
			memmove(&ls->vals[ls2.size], ls->vals, sizeof(sink_val) * ls->size);
		memcpy(ls->vals, ls2.vals, sizeof(sink_val) * ls2.size);
		ls->size += ls2.size;
	}
	return a;
}

static inline sink_val opi_list_find(context ctx, sink_val a, sink_val b, sink_val c){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list for list.find");
		return SINK_NIL;
	}
	if (!sink_isnil(c) && !sink_isnum(c)){
		opi_abortcstr(ctx, "Expecting number for list.find");
		return SINK_NIL;
	}
	list_st ls = var_castlist(ctx, a);
	int pos = (sink_isnil(c) || sink_num_isnan(c)) ? 0 : c.f;
	if (pos < 0)
		pos = 0;
	for (; pos < ls.size; pos++){
		if (opi_equ(ctx, ls.vals[pos], b))
			return sink_num(pos);
	}
	return SINK_NIL;
}

static inline sink_val opi_list_rfind(context ctx, sink_val a, sink_val b, sink_val c){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list for list.rfind");
		return SINK_NIL;
	}
	if (!sink_isnil(c) && !sink_isnum(c)){
		opi_abortcstr(ctx, "Expecting number for list.rfind");
		return SINK_NIL;
	}
	list_st ls = var_castlist(ctx, a);
	int pos = (sink_isnil(c) || sink_num_isnan(c)) ? ls.size - 1 : c.f;
	if (pos < 0 || pos >= ls.size)
		pos = ls.size - 1;
	for (; pos >= 0; pos--){
		if (opi_equ(ctx, ls.vals[pos], b))
			return sink_num(pos);
	}
	return SINK_NIL;
}

static inline sink_val opi_list_join(context ctx, sink_val a, sink_val b){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list for list.join");
		return SINK_NIL;
	}
	list_st ls = var_castlist(ctx, a);
	if (sink_isnil(b))
		b = sink_str_newblobgive(ctx, 0, NULL);
	else
		b = sink_tostr(ctx, b);
	str_st str = var_caststr(ctx, b);
	return sink_list_joinplain(ctx, ls.size, ls.vals, str.size, str.bytes);
}

static inline sink_val opi_list_rev(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list for list.rev");
		return SINK_NIL;
	}
	list_st *ls = var_castmlist(ctx, a);
	int max = ls->size / 2;
	for (int i = 0, ri = ls->size - 1; i < max; i++, ri--){
		sink_val temp = ls->vals[i];
		ls->vals[i] = ls->vals[ri];
		ls->vals[ri] = temp;
	}
	return a;
}

static inline sink_val opi_list_str(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list for list.str");
		return SINK_NIL;
	}
	list_st ls = var_castlist(ctx, a);
	uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (ls.size + 1));
	for (int i = 0; i < ls.size; i++){
		sink_val b = ls.vals[i];
		if (!sink_isnum(b)){
			mem_free(bytes);
			opi_abortcstr(ctx, "Expecting list of integers for list.str");
			return SINK_NIL;
		}
		int c = (int)b.f;
		if (c < 0)
			c = 0;
		else if (c > 255)
			c = 255;
		bytes[i] = c;
	}
	bytes[ls.size] = 0;
	return sink_str_newblobgive(ctx, ls.size, bytes);
}

static inline int sortboth(context ctx, list_int li, sink_val a, sink_val b){
	sink_type atype = sink_typeof(a);
	sink_type btype = sink_typeof(b);

	if (a.u == b.u)
		return 0;

	if (atype != btype){
		if (atype == SINK_TYPE_NIL)
			return -1;
		else if (atype == SINK_TYPE_NUM)
			return btype == SINK_TYPE_NIL ? 1 : -1;
		else if (atype == SINK_TYPE_STR)
			return btype == SINK_TYPE_LIST ? -1 : 1;
		return 1;
	}

	if (atype == SINK_TYPE_NUM){
		if (sink_num_isnan(a)){
			if (sink_num_isnan(b))
				return 0;
			return -1;
		}
		else if (sink_num_isnan(b))
			return 1;
		return a.f < b.f ? -1 : 1;
	}
	else if (atype == SINK_TYPE_STR){
		str_st s1 = var_caststr(ctx, a);
		str_st s2 = var_caststr(ctx, b);
		if (s1.size == 0){
			if (s2.size == 0)
				return 0;
			return -1;
		}
		else if (s2.size == 0)
			return 1;
		int res = memcmp(s1.bytes, s2.bytes,
			sizeof(uint8_t) * (s1.size < s2.size ? s1.size : s2.size));
		if (res == 0)
			return s1.size == s2.size ? 0 : (s1.size < s2.size ? -1 : 1);
		return res < 0 ? -1 : 1;
	}
	// otherwise, comparing two lists
	int idx1 = var_index(a);
	int idx2 = var_index(b);
	if (list_int_has(li, idx1) || list_int_has(li, idx2)){
		opi_abortcstr(ctx, "Cannot sort circular lists");
		return -1;
	}
	list_st ls1 = var_castlist(ctx, a);
	list_st ls2 = var_castlist(ctx, b);
	if (ls1.size == 0){
		if (ls2.size == 0)
			return 0;
		return -1;
	}
	else if (ls2.size == 0)
		return 1;
	int minsize = ls1.size < ls2.size ? ls1.size : ls2.size;
	list_int_push(li, idx1);
	list_int_push(li, idx2);
	for (int i = 0; i < minsize; i++){
		int res = sortboth(ctx, li, ls1.vals[i], ls2.vals[i]);
		if (res != 0){
			list_int_pop(li);
			list_int_pop(li);
			return res;
		}
	}
	list_int_pop(li);
	list_int_pop(li);
	if (ls1.size < ls2.size)
		return -1;
	else if (ls1.size > ls2.size)
		return 1;
	return 0;
}

typedef struct {
	context ctx;
	list_int li;
} sortu_st, *sortu;

static int sortfwd(sortu u, const sink_val *a, const sink_val *b){
	return sortboth(u->ctx, u->li, *a, *b);
}

static int sortrev(sortu u, const sink_val *a, const sink_val *b){
	return -sortboth(u->ctx, u->li, *a, *b);
}

typedef int (*sink_qsort_compare)(void *, const void *, const void *);

static void memswap(void *a, void *b, size_t size){
	#define WORD_TYPE uint64_t
	WORD_TYPE t;
	const size_t word_size = sizeof(WORD_TYPE);
	size_t words = size / word_size;
	size_t bytes = size % word_size;
	uint8_t *x = (uint8_t *)a;
	uint8_t *y = (uint8_t *)b;
	while (words--){
		memcpy(&t, x, word_size);
		memcpy(x, y, word_size);
		memcpy(y, &t, word_size);
		x += word_size;
		y += word_size;
	}
	while (bytes--){
		uint8_t t = *x;
		*x = *y;
		*y = t;
		x++;
		y++;
	}
	#undef WORD_TYPE
}

static void sink_qsort_r_helper(uint8_t *base, size_t m, size_t n, size_t elsize, void *thunk,
	sink_qsort_compare compare){
	const uint8_t *key = base + m * elsize;
	size_t i = m + 1;
	size_t j = n;
	while (i <= j){
		while (i <= n && compare(thunk, base + i * elsize, key) <= 0)
			i++;
		while (j >= m && compare(thunk, base + j * elsize, key) > 0)
			j--;
		if (i < j)
			memswap(base + i * elsize, base + j * elsize, elsize);
	}
	memswap(base + m * elsize, base + j * elsize, elsize);
	if (j > m + 1)
		sink_qsort_r_helper(base, m, j - 1, elsize, thunk, compare);
	if (n > j + 1)
		sink_qsort_r_helper(base, j + 1, n, elsize, thunk, compare);
}

static inline void sink_qsort_r(void *base, size_t elems, size_t elsize, void *thunk,
	sink_qsort_compare compare){
	if (elems <= 1)
		return;
	sink_qsort_r_helper(base, 0, elems - 1, elsize, thunk, compare);
}

static inline void opi_list_sort(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list for list.sort");
		return;
	}
	sortu_st u = { .ctx = ctx, .li = list_int_new() };
	list_st ls = var_castlist(ctx, a);
	sink_qsort_r(ls.vals, ls.size, sizeof(sink_val), &u,
		(int (*)(void *, const void *, const void *))sortfwd);
	list_int_free(u.li);
}

static inline void opi_list_rsort(context ctx, sink_val a){
	if (!sink_islist(a)){
		opi_abortcstr(ctx, "Expecting list for list.rsort");
		return;
	}
	sortu_st u = { .ctx = ctx, .li = list_int_new() };
	list_st ls = var_castlist(ctx, a);
	sink_qsort_r(ls.vals, ls.size, sizeof(sink_val), &u,
		(int (*)(void *, const void *, const void *))sortrev);
	list_int_free(u.li);
}

static inline int opi_order(context ctx, sink_val a, sink_val b){
	list_int li = list_int_new();
	int res = sortboth(ctx, li, a, b);
	list_int_free(li);
	return res;
}

static inline sink_val opi_range(context ctx, double start, double stop, double step){
	if (start == stop)
		return sink_list_newempty(ctx);
	if (step == 0){
		opi_abortcstr(ctx, "Range step cannot be 0");
		return SINK_NIL;
	}
	int64_t count = ceil((stop - start) / step);
	if (count > 10000000){
		opi_abortcstr(ctx, "Range too large (maximum 10000000)");
		return SINK_NIL;
	}
	if (count <= 0)
		return sink_list_newempty(ctx);
	sink_val *ret = mem_alloc(sizeof(sink_val) * count);
	for (int64_t i = 0; i < count; i++)
		ret[i] = sink_num(start + (double)i * step);
	return sink_list_newblobgive(ctx, count, count, ret);
}

static inline void numtostr(double num, char *buf, size_t bufsize, int *outsize){
	*outsize = snprintf(buf, bufsize, "%.16g", num);
	if (buf[0] == '-' && buf[1] == '0' && buf[2] == 0){ // fix negative zero silliness
		buf[0] = '0';
		buf[1] = 0;
		*outsize = 1;
	}
}

static inline bool pk_isjson(str_st s){
	enum {
		PKV_START,
		PKV_NULL1,
		PKV_NULL2,
		PKV_NULL3,
		PKV_NUM_0,
		PKV_NUM_NEG,
		PKV_NUM_INT,
		PKV_NUM_FRAC,
		PKV_NUM_FRACE,
		PKV_NUM_FRACE2,
		PKV_NUM_EXP,
		PKV_STR,
		PKV_STR_ESC,
		PKV_STR_U1,
		PKV_STR_U2,
		PKV_STR_U3,
		PKV_STR_U4,
		PKV_ARRAY,
		PKV_ENDVAL
	} state = PKV_START;
	int arrays = 0;
	for (int i = 0; i < s.size; i++){
		uint8_t b = s.bytes[i];
		uint8_t nb = i < s.size - 1 ? s.bytes[i + 1] : 0;
		switch (state){
			case PKV_START: // start state
				if (b == 'n'){
					if (nb != 'u')
						return false;
					state = PKV_NULL1;
				}
				else if (b == '0'){
					if (nb == '.' || nb == 'e' || nb == 'E')
						state = PKV_NUM_0;
					else
						state = PKV_ENDVAL;
				}
				else if (b == '-')
					state = PKV_NUM_NEG;
				else if (isNum((char)b)){
					if (isNum((char)nb))
						state = PKV_NUM_INT;
					else if (nb == '.' || nb == 'e' || nb == 'E')
						state = PKV_NUM_0;
					else
						state = PKV_ENDVAL;
				}
				else if (b == '"')
					state = PKV_STR;
				else if (b == '['){
					arrays++;
					if (isSpace((char)nb) || nb == ']')
						state = PKV_ARRAY;
				}
				else if (!isSpace((char)b))
					return false;
				break;
			case PKV_NULL1:
				if (nb != 'l')
					return false;
				state = PKV_NULL2;
				break;
			case PKV_NULL2:
				if (nb != 'l')
					return false;
				state = PKV_NULL3;
				break;
			case PKV_NULL3:
				state = PKV_ENDVAL;
				break;
			case PKV_NUM_0:
				if (b == '.')
					state = PKV_NUM_FRAC;
				else if (b == 'e' || b == 'E'){
					if (nb == '+' || nb == '-')
						i++;
					state = PKV_NUM_EXP;
				}
				else
					return false;
				break;
			case PKV_NUM_NEG:
				if (b == '0'){
					if (nb == '.' || nb == 'e' || nb == 'E')
						state = PKV_NUM_0;
					else
						state = PKV_ENDVAL;
				}
				else if (isNum((char)b)){
					if (isNum((char)nb))
						state = PKV_NUM_INT;
					else if (nb == '.' || nb == 'e' || nb == 'E')
						state = PKV_NUM_0;
					else
						state = PKV_ENDVAL;
				}
				else
					return false;
				break;
			case PKV_NUM_INT:
				if (!isNum((char)b))
					return false;
				if (nb == '.' || nb == 'e' || nb == 'E')
					state = PKV_NUM_0;
				else if (!isNum((char)nb))
					state = PKV_ENDVAL;
				break;
			case PKV_NUM_FRAC:
				if (!isNum((char)b))
					return false;
				if (nb == 'e' || nb == 'E')
					state = PKV_NUM_FRACE;
				else if (!isNum((char)nb))
					state = PKV_ENDVAL;
				break;
			case PKV_NUM_FRACE:
				state = PKV_NUM_FRACE2;
				break;
			case PKV_NUM_FRACE2:
				if (isNum((char)b)){
					if (isNum((char)nb))
						state = PKV_NUM_EXP;
					else
						state = PKV_ENDVAL;
				}
				else if (b == '+' || b == '-')
					state = PKV_NUM_EXP;
				else
					return false;
				break;
			case PKV_NUM_EXP:
				if (!isNum((char)b))
					return false;
				if (!isNum((char)nb))
					state = PKV_ENDVAL;
				break;
			case PKV_STR:
				if (b == '\\')
					state = PKV_STR_ESC;
				else if (b == '"')
					state = PKV_ENDVAL;
				else if (b < ' ')
					return false;
				break;
			case PKV_STR_ESC:
				if (b == '"' || b == '\\' || b == '/' || b == 'b' ||
					b == 'f' || b == 'n' || b == 'r' || b == 't')
					state = PKV_STR;
				else if (b == 'u'){
					if (nb != '0')
						return false;
					state = PKV_STR_U1;
				}
				else
					return false;
				break;
			case PKV_STR_U1:
				if (nb != '0')
					return false;
				state = PKV_STR_U2;
				break;
			case PKV_STR_U2:
				if (!isHex((char)nb))
					return false;
				state = PKV_STR_U3;
				break;
			case PKV_STR_U3:
				if (!isHex((char)nb))
					return false;
				state = PKV_STR_U4;
				break;
			case PKV_STR_U4:
				state = PKV_STR;
				break;
			case PKV_ARRAY:
				if (b == ']')
					state = PKV_ENDVAL;
				else if (!isSpace((char)nb) && nb != ']')
					state = PKV_START;
				break;
			case PKV_ENDVAL:
				if (arrays > 0){
					if (b == ',')
						state = PKV_START;
					else if (b == ']')
						arrays--;
					else if (!isSpace((char)b))
						return false;
				}
				else if (!isSpace((char)b))
					return false;
				break;
		}
	}
	return state == PKV_ENDVAL;
}

static bool pk_tojson(context ctx, sink_val a, list_int li, str_st *s){
	switch (sink_typeof(a)){
		case SINK_TYPE_NIL:
			set_null:
			s->size = 4;
			s->bytes = mem_alloc(sizeof(uint8_t) * 5);
			s->bytes[0] = 'n';
			s->bytes[1] = 'u';
			s->bytes[2] = 'l';
			s->bytes[3] = 'l';
			s->bytes[4] = 0;
			return true;
		case SINK_TYPE_NUM: {
			char buf[64];
			int sz;
			numtostr(a.f, buf, sizeof(buf), &sz);
			str_st s2 = { .size = sz, .bytes = (uint8_t *)buf };
			if (pk_isjson(s2)){
				s->size = sz;
				s->bytes = mem_alloc(sizeof(uint8_t) * (sz + 1));
				memcpy(s->bytes, buf, sizeof(uint8_t) * (sz + 1));
				return true;
			}
			// if C's rendering of the number is not valid JSON, then we have a goofy number, so
			// just set it to null
			goto set_null;
		} break;
		case SINK_TYPE_STR: {
			int tot = 2;
			str_st src = var_caststr(ctx, a);
			// calculate total size first
			for (int i = 0; i < src.size; i++){
				uint8_t b = src.bytes[i];
				if (b == '"' || b == '\\' || b == '\b' || b == '\f' || b == '\n' || b == '\r' ||
					b == '\t')
					tot += 2;
				else if (b < 0x20 || b >= 0x80) // \u00XX
					tot += 6;
				else
					tot++;
			}
			s->size = tot;
			s->bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
			// render string
			int pos = 0;
			s->bytes[pos++] = '"';
			for (int i = 0; i < src.size; i++){
				uint8_t b = src.bytes[i];
				if (b == '"' || b == '\\'){
					s->bytes[pos++] = '\\';
					s->bytes[pos++] = b;
				}
				else if (b == '\b'){
					s->bytes[pos++] = '\\';
					s->bytes[pos++] = 'b';
				}
				else if (b == '\f'){
					s->bytes[pos++] = '\\';
					s->bytes[pos++] = 'f';
				}
				else if (b == '\n'){
					s->bytes[pos++] = '\\';
					s->bytes[pos++] = 'n';
				}
				else if (b == '\r'){
					s->bytes[pos++] = '\\';
					s->bytes[pos++] = 'r';
				}
				else if (b == '\t'){
					s->bytes[pos++] = '\\';
					s->bytes[pos++] = 't';
				}
				else if (b < 0x20 || b >= 0x80){ // \u00XX
					s->bytes[pos++] = '\\';
					s->bytes[pos++] = 'u';
					s->bytes[pos++] = '0';
					s->bytes[pos++] = '0';
					s->bytes[pos++] = toNibble((b >> 4) & 0x0F);
					s->bytes[pos++] = toNibble(b & 0x0F);
				}
				else
					s->bytes[pos++] = b;
			}
			s->bytes[pos++] = '"';
			s->bytes[pos] = 0;
			return true;
		} break;
		case SINK_TYPE_LIST: {
			int idx = var_index(a);
			if (list_int_has(li, idx))
				return false; // circular
			list_int_push(li, idx);
			list_st ls = var_castlist(ctx, a);
			int tot = 2;
			str_st *strs = mem_alloc(sizeof(str_st) * ls.size);
			for (int i = 0; i < ls.size; i++){
				str_st s2;
				if (!pk_tojson(ctx, ls.vals[i], li, &s2)){
					for (int j = 0; j < i; j++)
						mem_free(strs[j].bytes);
					mem_free(strs);
					return false;
				}
				strs[i] = s2;
				tot += (i == 0 ? 0 : 1) + s2.size;
			}
			list_int_pop(li);
			uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
			bytes[0] = '[';
			int p = 1;
			for (int i = 0; i < ls.size; i++){
				if (i > 0)
					bytes[p++] = ',';
				memcpy(&bytes[p], strs[i].bytes, sizeof(uint8_t) * strs[i].size);
				mem_free(strs[i].bytes);
				p += strs[i].size;
			}
			mem_free(strs);
			bytes[p] = ']';
			bytes[tot] = 0;
			s->size = tot;
			s->bytes = bytes;
			return true;
		} break;
	}
}

static inline sink_val opi_pickle_json(context ctx, sink_val a){
	list_int li = NULL;
	if (sink_islist(a))
		li = list_int_new();
	str_st s = { .size = 0, .bytes = NULL};
	bool suc = pk_tojson(ctx, a, li, &s);
	if (li)
		list_int_free(li);
	if (!suc){
		if (s.bytes)
			mem_free(s.bytes);
		if (!ctx->failed)
			opi_abortcstr(ctx, "Cannot pickle circular structure to JSON format");
		return SINK_NIL;
	}
	return sink_str_newblobgive(ctx, s.size, s.bytes);
}

static inline void pk_tobin_vint(list_byte body, uint32_t i){
	if (i < 128)
		list_byte_push(body, i);
	else{
		list_byte_push4(body,
			0x80 | (i >> 24),
			(i >> 16) & 0xFF,
			(i >>  8) & 0xFF,
			 i        & 0xFF);
	}
}

static void pk_tobin(context ctx, sink_val a, list_int li, uint32_t *str_table_size, list_byte strs,
	list_byte body){
	switch (sink_typeof(a)){
		case SINK_TYPE_NIL:
			list_byte_push(body, 0xF7);
			break;
		case SINK_TYPE_NUM: {
			if (floor(a.f) == a.f && a.f >= -4294967296.0 && a.f < 4294967296.0){
				int64_t num = a.f;
				if (num < 0){
					if (num >= -256){
						num += 256;
						list_byte_push2(body, 0xF1, num & 0xFF);
					}
					else if (num >= -65536){
						num += 65536;
						list_byte_push3(body, 0xF3, num & 0xFF, num >> 8);
					}
					else{
						num += 4294967296;
						list_byte_push5(body, 0xF5, num & 0xFF, (num >> 8) & 0xFF,
							(num >> 16) & 0xFF, (num >> 24) & 0xFF);
					}
				}
				else{
					if (num < 256)
						list_byte_push2(body, 0xF0, num & 0xFF);
					else if (num < 65536)
						list_byte_push3(body, 0xF2, num & 0xFF, num >> 8);
					else{
						list_byte_push5(body, 0xF4, num & 0xFF, (num >> 8) & 0xFF,
							(num >> 16) & 0xFF, (num >> 24) & 0xFF);
					}
				}
			}
			else{
				list_byte_push9(body, 0xF6,
					a.u & 0xFF, (a.u >> 8) & 0xFF, (a.u >> 16) & 0xFF, (a.u >> 24) & 0xFF,
					(a.u >> 32) & 0xFF, (a.u >> 40) & 0xFF, (a.u >> 48) & 0xFF, (a.u >> 56) & 0xFF);
			}
		} break;
		case SINK_TYPE_STR: {
			// search for a previous string
			str_st s = var_caststr(ctx, a);
			int spos = 0;
			uint32_t sidx = 0;
			bool found = false;
			while (!found && sidx < *str_table_size){
				uint32_t vi = strs->bytes[spos++];
				if (vi >= 128){
					vi = ((vi ^ 0x80) << 24) |
						((uint32_t)strs->bytes[spos    ] << 16) |
						((uint32_t)strs->bytes[spos + 1] <<  8) |
						((uint32_t)strs->bytes[spos + 2]      );
					spos += 3;
				}
				if (vi == s.size){
					found = vi == 0 ||
						memcmp(&strs->bytes[spos], s.bytes, sizeof(uint8_t) * vi) == 0;
				}
				if (!found){
					spos += vi;
					sidx++;
				}
			}
			if (!found){
				pk_tobin_vint(strs, s.size);
				list_byte_append(strs, s.size, s.bytes);
				sidx = *str_table_size;
				(*str_table_size)++;
			}
			list_byte_push(body, 0xF8);
			pk_tobin_vint(body, sidx);
		} break;
		case SINK_TYPE_LIST: {
			int idx = var_index(a);
			int idxat = list_int_at(li, idx);
			if (idxat < 0){
				list_int_push(li, idx);
				list_st ls = var_castlist(ctx, a);
				list_byte_push(body, 0xF9);
				pk_tobin_vint(body, ls.size);
				for (int i = 0; i < ls.size; i++)
					pk_tobin(ctx, ls.vals[i], li, str_table_size, strs, body);
			}
			else{
				list_byte_push(body, 0xFA);
				pk_tobin_vint(body, idxat);
			}
		} break;
	}
}

static inline void opi_pickle_binstr(context ctx, sink_val a, str_st *out){
	list_int li = NULL;
	if (sink_islist(a))
		li = list_int_new();
	uint32_t str_table_size = 0;
	list_byte strs = list_byte_new();
	list_byte body = list_byte_new();
	pk_tobin(ctx, a, li, &str_table_size, strs, body);
	if (li)
		list_int_free(li);
	int tot = 1 + (str_table_size < 128 ? 1 : 4) + strs->size + body->size;
	uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
	int pos = 0;
	bytes[pos++] = 0x01;
	if (str_table_size < 128)
		bytes[pos++] = str_table_size;
	else{
		bytes[pos++] = 0x80 | (str_table_size >> 24);
		bytes[pos++] = (str_table_size >> 16) & 0xFF;
		bytes[pos++] = (str_table_size >>  8) & 0xFF;
		bytes[pos++] =  str_table_size        & 0xFF;
	}
	if (strs->size > 0){
		memcpy(&bytes[pos], strs->bytes, sizeof(uint8_t) * strs->size);
		pos += strs->size;
	}
	memcpy(&bytes[pos], body->bytes, sizeof(uint8_t) * body->size);
	bytes[tot] = 0;
	list_byte_free(strs);
	list_byte_free(body);
	out->size = tot;
	out->bytes = bytes;
}

static inline sink_val opi_pickle_bin(context ctx, sink_val a){
	str_st str;
	opi_pickle_binstr(ctx, a, &str);
	return sink_str_newblobgive(ctx, str.size, str.bytes);
}

static inline bool pk_fmbin_vint(str_st s, uint64_t *pos, uint32_t *res){
	if (s.size <= *pos)
		return false;
	uint32_t v = s.bytes[*pos];
	(*pos)++;
	if (v < 128){
		*res = v;
		return true;
	}
	if (s.size <= *pos + 2)
		return false;
	*res = ((v ^ 0x80) << 24) |
		((uint32_t)s.bytes[*pos    ] << 16) |
		((uint32_t)s.bytes[*pos + 1] <<  8) |
		((uint32_t)s.bytes[*pos + 2]      );
	(*pos) += 3;
	return true;
}

static bool pk_fmbin(context ctx, str_st s, uint64_t *pos, uint32_t str_table_size,
	sink_val *strs, list_int li, sink_val *res){
	if (*pos >= s.size)
		return false;
	uint8_t cmd = s.bytes[*pos];
	(*pos)++;
	switch (cmd){
		case 0xF0: {
			if (*pos >= s.size)
				return false;
			*res = sink_num(s.bytes[*pos]);
			(*pos)++;
			return true;
		} break;
		case 0xF1: {
			if (*pos >= s.size)
				return false;
			*res = sink_num((int)s.bytes[*pos] - 256);
			(*pos)++;
			return true;
		} break;
		case 0xF2: {
			if (*pos + 1 >= s.size)
				return false;
			*res = sink_num(
				(int)s.bytes[*pos] |
				((int)s.bytes[*pos + 1] << 8));
			(*pos) += 2;
			return true;
		} break;
		case 0xF3: {
			if (*pos + 1 >= s.size)
				return false;
			*res = sink_num(
				((int)s.bytes[*pos] |
				((int)s.bytes[*pos + 1] << 8)) - 65536);
			(*pos) += 2;
			return true;
		} break;
		case 0xF4: {
			if (*pos + 3 >= s.size)
				return false;
			*res = sink_num(
				(int)s.bytes[*pos] |
				((int)s.bytes[*pos + 1] <<  8) |
				((int)s.bytes[*pos + 2] << 16) |
				((int)s.bytes[*pos + 3] << 24));
			(*pos) += 4;
			return true;
		} break;
		case 0xF5: {
			if (*pos + 3 >= s.size)
				return false;
			*res = sink_num(
				((double)((uint32_t)s.bytes[*pos] |
				((uint32_t)s.bytes[*pos + 1] <<  8) |
				((uint32_t)s.bytes[*pos + 2] << 16) |
				((uint32_t)s.bytes[*pos + 3] << 24))) - 4294967296.0);
			(*pos) += 4;
			return true;
		} break;
		case 0xF6: {
			if (*pos + 7 >= s.size)
				return false;
			res->u = ((uint64_t)s.bytes[*pos]) |
				(((uint64_t)s.bytes[*pos + 1]) <<  8) |
				(((uint64_t)s.bytes[*pos + 2]) << 16) |
				(((uint64_t)s.bytes[*pos + 3]) << 24) |
				(((uint64_t)s.bytes[*pos + 4]) << 32) |
				(((uint64_t)s.bytes[*pos + 5]) << 40) |
				(((uint64_t)s.bytes[*pos + 6]) << 48) |
				(((uint64_t)s.bytes[*pos + 7]) << 56);
			if (isnan(res->f)) // make sure no screwy NaN's come in
				*res = sink_num_nan();
			(*pos) += 8;
			return true;
		} break;
		case 0xF7: {
			*res = SINK_NIL;
			return true;
		} break;
		case 0xF8: {
			uint32_t id;
			if (!pk_fmbin_vint(s, pos, &id) || id >= str_table_size)
				return false;
			*res = strs[id];
			return true;
		} break;
		case 0xF9: {
			uint32_t sz;
			if (!pk_fmbin_vint(s, pos, &sz))
				return false;
			if (sz <= 0){
				*res = sink_list_newempty(ctx);
				list_int_push(li, var_index(*res));
			}
			else{
				sink_val *vals = mem_alloc(sizeof(sink_val) * sz);
				memset(vals, 0, sizeof(sink_val) * sz);
				*res = sink_list_newblobgive(ctx, sz, sz, vals);
				list_int_push(li, var_index(*res));
				for (uint32_t i = 0; i < sz; i++){
					if (!pk_fmbin(ctx, s, pos, str_table_size, strs, li, &vals[i]))
						return false;
				}
			}
			return true;
		} break;
		case 0xFA: {
			uint32_t id;
			if (!pk_fmbin_vint(s, pos, &id) || id >= li->size)
				return false;
			*res = (sink_val){ .u = SINK_TAG_LIST | li->vals[id] };
			return true;
		} break;
	}
	return false;
}

static bool pk_fmjson(context ctx, str_st s, int *pos, sink_val *res){
	while (*pos < s.size && isSpace((char)s.bytes[*pos]))
		(*pos)++;
	if (*pos >= s.size)
		return false;
	uint8_t b = s.bytes[*pos];
	(*pos)++;
	if (b == 'n'){
		if (*pos + 2 >= s.size)
			return false;
		if (s.bytes[*pos + 0] != 'u' ||
			s.bytes[*pos + 1] != 'l' ||
			s.bytes[*pos + 2] != 'l')
			return false;
		(*pos) += 3;
		*res = SINK_NIL;
		return true;
	}
	else if (isNum((char)b) || b == '-'){
		numpart_info npi;
		numpart_new(&npi);
		if (b == '-'){
			if (*pos >= s.size)
				return false;
			npi.sign = -1;
			b = s.bytes[*pos];
			(*pos)++;
			if (!isNum((char)b))
				return false;
		}
		if (b >= '1' && b <= '9'){
			npi.val = b - '0';
			while (*pos < s.size && isNum((char)s.bytes[*pos])){
				npi.val = 10 * npi.val + s.bytes[*pos] - '0';
				(*pos)++;
			}
		}
		if (s.bytes[*pos] == '.'){
			(*pos)++;
			if (*pos >= s.size || !isNum((char)s.bytes[*pos]))
				return false;
			while (*pos < s.size && isNum((char)s.bytes[*pos])){
				npi.frac = npi.frac * 10 + s.bytes[*pos] - '0';
				npi.flen++;
				(*pos)++;
			}
		}
		if (s.bytes[*pos] == 'e' || s.bytes[*pos] == 'E'){
			(*pos)++;
			if (*pos >= s.size)
				return false;
			if (s.bytes[*pos] == '-' || s.bytes[*pos] == '+'){
				npi.esign = s.bytes[*pos] == '-' ? -1 : 1;
				(*pos)++;
				if (*pos >= s.size)
					return false;
			}
			if (!isNum((char)s.bytes[*pos]))
				return false;
			while (*pos < s.size && isNum((char)s.bytes[*pos])){
				npi.eval = npi.eval * 10 + s.bytes[*pos] - '0';
				(*pos)++;
			}
		}
		*res = sink_num(numpart_calc(npi));
		return true;
	}
	else if (b == '"'){
		list_byte str = list_byte_new();
		while (*pos < s.size){
			b = s.bytes[*pos];
			if (b == '"'){
				(*pos)++;
				list_byte_null(str);
				str_st bstr = list_byte_freetostr(str);
				*res = sink_str_newblobgive(ctx, bstr.size, bstr.bytes);
				return true;
			}
			else if (b == '\\'){
				(*pos)++;
				if (*pos >= s.size){
					list_byte_free(str);
					return false;
				}
				b = s.bytes[*pos];
				if (b == '"' || b == '\\')
					list_byte_push(str, b);
				else if (b == 'b')
					list_byte_push(str, '\b');
				else if (b == 'f')
					list_byte_push(str, '\f');
				else if (b == 'n')
					list_byte_push(str, '\n');
				else if (b == 'r')
					list_byte_push(str, '\r');
				else if (b == 't')
					list_byte_push(str, '\t');
				else if (b == 'u'){
					if (*pos + 4 >= s.size ||
						s.bytes[*pos + 1] != '0' || s.bytes[*pos + 2] != '0' ||
						!isHex(s.bytes[*pos + 3]) || !isHex(s.bytes[*pos + 4])){
						list_byte_free(str);
						return false;
					}
					list_byte_push(str,
						(toHex(s.bytes[*pos + 3]) << 4) | toHex(s.bytes[*pos + 4]));
					(*pos) += 4;
				}
				else{
					list_byte_free(str);
					return false;
				}
			}
			else if (b < 0x20){
				list_byte_free(str);
				return false;
			}
			else
				list_byte_push(str, b);
			(*pos)++;
		}
		list_byte_free(str);
		return false;
	}
	else if (b == '['){
		while (*pos < s.size && isSpace((char)s.bytes[*pos]))
			(*pos)++;
		if (*pos >= s.size)
			return false;
		if (s.bytes[*pos] == ']'){
			(*pos)++;
			*res = sink_list_newempty(ctx);
			return true;
		}
		*res = sink_list_newempty(ctx);
		while (true){
			sink_val item;
			if (!pk_fmjson(ctx, s, pos, &item))
				return false;
			sink_list_push(ctx, *res, item);
			while (*pos < s.size && isSpace((char)s.bytes[*pos]))
				(*pos)++;
			if (*pos >= s.size)
				return false;
			if (s.bytes[*pos] == ']'){
				(*pos)++;
				return true;
			}
			else if (s.bytes[*pos] == ',')
				(*pos)++;
			else
				return false;
		}
	}
	return false;
}

static inline bool opi_pickle_valstr(context ctx, str_st s, sink_val *res){
	if (s.size < 1 || s.bytes[0] != 0x01)
		return false;
	uint64_t pos = 1;
	uint32_t str_table_size;
	if (!pk_fmbin_vint(s, &pos, &str_table_size))
		return false;
	sink_val *strs = NULL;
	if (str_table_size > 0)
		strs = mem_alloc(sizeof(sink_val) * str_table_size);
	for (uint32_t i = 0; i < str_table_size; i++){
		uint32_t str_size;
		if (!pk_fmbin_vint(s, &pos, &str_size) || pos + str_size > s.size){
			mem_free(strs);
			return false;
		}
		strs[i] = sink_str_newblob(ctx, str_size, &s.bytes[pos]);
		pos += str_size;
	}
	list_int li = list_int_new();
	if (!pk_fmbin(ctx, s, &pos, str_table_size, strs, li, res)){
		mem_free(strs);
		list_int_free(li);
		return false;
	}
	mem_free(strs);
	list_int_free(li);
	return true;
}

static inline sink_val opi_pickle_val(context ctx, sink_val a){
	if (!sink_isstr(a)){
		opi_abortcstr(ctx, "Invalid pickle data");
		return SINK_NIL;
	}
	str_st s = var_caststr(ctx, a);
	if (s.size < 1){
		opi_abortcstr(ctx, "Invalid pickle data");
		return SINK_NIL;
	}
	if (s.bytes[0] == 0x01){ // binary decode
		sink_val res;
		if (!opi_pickle_valstr(ctx, s, &res)){
			opi_abortcstr(ctx, "Invalid pickle data");
			return SINK_NIL;
		}
		return res;
	}
	// otherwise, json decode
	int pos = 0;
	sink_val res;
	if (!pk_fmjson(ctx, s, &pos, &res)){
		opi_abortcstr(ctx, "Invalid pickle data");
		return SINK_NIL;
	}
	while (pos < s.size){
		if (!isSpace(s.bytes[pos])){
			opi_abortcstr(ctx, "Invalid pickle data");
			return SINK_NIL;
		}
		pos++;
	}
	return res;
}

static inline bool pk_isbin_adv(str_st s, uint64_t *pos, uint32_t amt){
	(*pos) += amt;
	return *pos <= s.size;
}

static bool pk_isbin(str_st s, uint64_t *pos, uint32_t *index, uint32_t str_table_size){
	if (s.size <= *pos)
		return false;
	uint8_t cmd = s.bytes[*pos];
	(*pos)++;
	switch (cmd){
		case 0xF0: return pk_isbin_adv(s, pos, 1);
		case 0xF1: return pk_isbin_adv(s, pos, 1);
		case 0xF2: return pk_isbin_adv(s, pos, 2);
		case 0xF3: return pk_isbin_adv(s, pos, 2);
		case 0xF4: return pk_isbin_adv(s, pos, 4);
		case 0xF5: return pk_isbin_adv(s, pos, 4);
		case 0xF6: return pk_isbin_adv(s, pos, 8);
		case 0xF7: return true;
		case 0xF8: {
			uint32_t str_id;
			if (!pk_fmbin_vint(s, pos, &str_id))
				return false;
			if (str_id >= str_table_size)
				return false;
			return true;
		} break;
		case 0xF9: {
			(*index)++;
			uint32_t list_size;
			if (!pk_fmbin_vint(s, pos, &list_size))
				return false;
			for (uint32_t i = 0; i < list_size; i++){
				if (!pk_isbin(s, pos, index, str_table_size))
					return false;
			}
			return true;
		} break;
		case 0xFA: {
			uint32_t ref;
			if (!pk_fmbin_vint(s, pos, &ref))
				return false;
			if (ref >= *index)
				return false;
			return true;
		} break;
	}
	return false;
}

static inline int opi_pickle_valid(context ctx, sink_val a){
	if (!sink_isstr(a))
		return 0;
	str_st s = var_caststr(ctx, a);
	if (s.bytes == NULL)
		return 0;
	if (s.bytes[0] == 0x01){ // binary validation
		uint64_t pos = 1;
		uint32_t str_table_size;
		if (!pk_fmbin_vint(s, &pos, &str_table_size))
			return 0;
		for (uint32_t i = 0; i < str_table_size; i++){
			uint32_t str_size;
			if (!pk_fmbin_vint(s, &pos, &str_size))
				return 0;
			pos += str_size; // skip over string's raw bytes
		}
		uint32_t index = 0;
		if (!pk_isbin(s, &pos, &index, str_table_size))
			return 0;
		if (pos != s.size)
			return 0;
		return 2;
	}
	// otherwise, json validation
	return pk_isjson(s) ? 1 : 0;
}

static bool pk_sib(context ctx, sink_val a, list_int all, list_int parents){
	int idx = var_index(a);
	if (list_int_has(parents, idx))
		return false;
	if (list_int_has(all, idx))
		return true;
	list_int_push(all, idx);
	list_int_push(parents, idx);
	list_st ls = var_castlist(ctx, a);
	for (int i = 0; i < ls.size; i++){
		sink_val b = ls.vals[i];
		if (!sink_islist(b))
			continue;
		if (pk_sib(ctx, b, all, parents))
			return true;
	}
	list_int_pop(parents);
	return false;
}

static inline bool opi_pickle_sibling(context ctx, sink_val a){
	if (!sink_islist(a))
		return false;
	list_int all = list_int_new();
	list_int parents = list_int_new();
	bool res = pk_sib(ctx, a, all, parents);
	list_int_free(all);
	list_int_free(parents);
	return res;
}

static bool pk_cir(context ctx, sink_val a, list_int li){
	int idx = var_index(a);
	if (list_int_has(li, idx))
		return true;
	list_int_push(li, idx);
	list_st ls = var_castlist(ctx, a);
	for (int i = 0; i < ls.size; i++){
		sink_val b = ls.vals[i];
		if (!sink_islist(b))
			continue;
		if (pk_cir(ctx, b, li))
			return true;
	}
	list_int_pop(li);
	return false;
}

static inline bool opi_pickle_circular(context ctx, sink_val a){
	if (!sink_islist(a))
		return false;
	list_int ls = list_int_new();
	bool res = pk_cir(ctx, a, ls);
	list_int_free(ls);
	return res;
}

static sink_val pk_copy(context ctx, sink_val a, list_int li_src, list_int li_tgt){
	switch (sink_typeof(a)){
		case SINK_TYPE_NIL:
		case SINK_TYPE_NUM:
		case SINK_TYPE_STR:
			return a;
		case SINK_TYPE_LIST: {
			int idx = var_index(a);
			int idxat = list_int_at(li_src, idx);
			if (idxat < 0){
				list_st ls = var_castlist(ctx, a);
				if (ls.size <= 0){
					sink_val b = sink_list_newempty(ctx);
					list_int_push(li_src, idx);
					list_int_push(li_tgt, var_index(b));
					return b;
				}
				else{
					sink_val *m = mem_alloc(sizeof(sink_val) * ls.size);
					memset(m, 0, sizeof(sink_val) * ls.size);
					sink_val b = sink_list_newblobgive(ctx, ls.size, ls.size, m);
					list_int_push(li_src, idx);
					list_int_push(li_tgt, var_index(b));
					for (int i = 0; i < ls.size; i++)
						m[i] = pk_copy(ctx, ls.vals[i], li_src, li_tgt);
					return b;
				}
			}
			// otherwise, use the last generated list
			return (sink_val){ .u = SINK_TAG_LIST | li_tgt->vals[idxat] };
		} break;
	}
}

static inline sink_val opi_pickle_copy(context ctx, sink_val a){
	list_int li_src = NULL, li_tgt = NULL;
	if (sink_islist(a)){
		li_src = list_int_new();
		li_tgt = list_int_new();
	}
	a = pk_copy(ctx, a, li_src, li_tgt);
	if (li_src){
		list_int_free(li_src);
		list_int_free(li_tgt);
	}
	return a;
}

static inline uint8_t *opi_list_joinplain(sink_ctx ctx, int size, const sink_val *vals, int sepz,
	const uint8_t *sep, int *totv);

// op descriptions for error messages
static const char *txt_num_neg      = "negating";
static const char *txt_num_add      = "adding";
static const char *txt_num_sub      = "subtracting";
static const char *txt_num_mul      = "multiplying";
static const char *txt_num_div      = "dividing";
static const char *txt_num_mod      = "taking modular";
static const char *txt_num_pow      = "exponentiating";
static const char *txt_num_abs      = "taking absolute value";
static const char *txt_num_sign     = "taking sign";
static const char *txt_num_clamp    = "clamping";
static const char *txt_num_floor    = "taking floor";
static const char *txt_num_ceil     = "taking ceil";
static const char *txt_num_round    = "rounding";
static const char *txt_num_trunc    = "truncating";
static const char *txt_num_isnan    = "testing if NaN";
static const char *txt_num_isfinite = "testing if finite";
static const char *txt_num_sin      = "taking sin";
static const char *txt_num_cos      = "taking cos";
static const char *txt_num_tan      = "taking tan";
static const char *txt_num_asin     = "taking arc-sin";
static const char *txt_num_acos     = "taking arc-cos";
static const char *txt_num_atan     = "taking arc-tan";
static const char *txt_num_log      = "taking logarithm";
static const char *txt_num_lerp     = "lerping";
static const char *txt_num_hex      = "converting to hex";
static const char *txt_num_oct      = "converting to oct";
static const char *txt_num_bin      = "converting to bin";
static const char *txt_int_new      = "casting to int";
static const char *txt_int_not      = "NOTing";
static const char *txt_int_and      = "ANDing";
static const char *txt_int_or       = "ORing";
static const char *txt_int_xor      = "XORing";
static const char *txt_int_shl      = "shifting left";
static const char *txt_int_shr      = "shifting right";
static const char *txt_int_clz      = "counting leading zeros";
static const char *txt_int_pop      = "population count";
static const char *txt_int_bswap    = "byte swaping";

static void context_run_w(context ctx, waitt wrun);
static inline sink_wait context_run(context ctx){
	waitt wrun = wait_get(ctx);
	wait_make(wrun, ctx);
	context_run_w(ctx, wrun);
	return wrun;
}

static void context_run_then(context ctx, sink_val result, waitt wrun){
	var_set(ctx, ctx->async_frame, ctx->async_index, result);
	ctx->async = false;
	context_run_w(ctx, wrun); // resume execution with result
}

static void context_run_w(context ctx, waitt wrun){
	#define RUNDONE(res) do{                                                               \
			sink_run result = res;                                                         \
			if (result == SINK_RUN_PASS || result == SINK_RUN_FAIL){                       \
				context_reset(ctx);                                                        \
				if (!ctx->prg->repl){                                                      \
					ctx->passed = result == SINK_RUN_PASS;                                 \
					ctx->failed = result == SINK_RUN_FAIL;                                 \
				}                                                                          \
			}                                                                              \
			wrun->has_result = true;                                                       \
			wrun->result = sink_num(result);                                               \
			if (wrun->has_then)                                                            \
				wait_fire(wrun);                                                           \
			return;                                                                        \
		}while(false)

	#define GOTWAIT(gw) do{                                                                \
			waitt w = gw;                                                                  \
			if (ctx->failed)                                                               \
				RUNDONE(SINK_RUN_FAIL);                                                    \
			if (w == NULL){                                                                \
				/* quick way to return nil */                                              \
				var_set(ctx, A, B, SINK_NIL);                                              \
			}                                                                              \
			else if (w->has_result){                                                       \
				/* don't have to actually wait for result, so just roll with it */         \
				var_set(ctx, A, B, w->result);                                             \
				wait_release(ctx, w);                                                      \
			}                                                                              \
			else{                                                                          \
				ctx->async = true;                                                         \
				ctx->async_frame = A;                                                      \
				ctx->async_index = B;                                                      \
				ctx->timeout_left = ctx->timeout;                                          \
				sink_then(w, (sink_then_st){                                               \
					.f_then = (sink_then_f)context_run_then,                               \
					.f_cancel = NULL,                                                      \
					.user = wrun                                                           \
				});                                                                        \
				return;                                                                    \
			}                                                                              \
		}while(false)

	if (ctx->passed) RUNDONE(SINK_RUN_PASS );
	if (ctx->failed) RUNDONE(SINK_RUN_FAIL );
	if (ctx->async ) RUNDONE(SINK_RUN_ASYNC);

	if (ctx->timeout > 0 && ctx->timeout_left <= 0){
		ctx->timeout_left = ctx->timeout;
		RUNDONE(SINK_RUN_TIMEOUT);
	}

	int32_t A, B, C, D, E, F, G, H, I, J;
	sink_val X, Y, Z, W;
	list_st ls;
	str_st str;
	sink_val p[256];

	list_byte ops = ctx->prg->ops;

	#define LOAD_ab()                                                                      \
		ctx->pc++;                                                                         \
		A = ops->bytes[ctx->pc++]; B = ops->bytes[ctx->pc++];

	#define LOAD_abc()                                                                     \
		LOAD_ab();                                                                         \
		C = ops->bytes[ctx->pc++];

	#define LOAD_abcd()                                                                    \
		LOAD_ab();                                                                         \
		C = ops->bytes[ctx->pc++]; D = ops->bytes[ctx->pc++];

	#define LOAD_abcde()                                                                   \
		LOAD_abcd();                                                                       \
		E = ops->bytes[ctx->pc++];                                                         \

	#define LOAD_abcdef()                                                                  \
		LOAD_abcd();                                                                       \
		E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];

	#define LOAD_abcdefg()                                                                 \
		LOAD_abcdef();                                                                     \
		G = ops->bytes[ctx->pc++];

	#define LOAD_abcdefgh()                                                                \
		LOAD_abcdef();                                                                     \
		G = ops->bytes[ctx->pc++]; H = ops->bytes[ctx->pc++];

	#define LOAD_abcdefghi()                                                               \
		LOAD_abcdefgh();                                                                   \
		I = ops->bytes[ctx->pc++];

	#define LOAD_abcdefghij()                                                              \
		LOAD_abcdefgh();                                                                   \
		I = ops->bytes[ctx->pc++]; J = ops->bytes[ctx->pc++];

	#define INLINE_UNOP(func, erop)                                                        \
		LOAD_abcd();                                                                       \
		var_set(ctx, A, B, opi_unop(ctx, var_get(ctx, C, D), func, erop));                 \
		if (ctx->failed)                                                                   \
			RUNDONE(SINK_RUN_FAIL);

	#define INLINE_BINOP_T(func, erop, t1, t2)                                             \
		LOAD_abcdef();                                                                     \
		var_set(ctx, A, B,                                                                 \
			opi_binop(ctx, var_get(ctx, C, D), var_get(ctx, E, F), func, erop, t1, t2));   \
		if (ctx->failed)                                                                   \
			RUNDONE(SINK_RUN_FAIL);

	#define INLINE_BINOP(func, erop) INLINE_BINOP_T(func, erop, LT_ALLOWNUM, LT_ALLOWNUM)

	#define INLINE_TRIOP(func, erop)                                                       \
		LOAD_abcdefgh();                                                                   \
		var_set(ctx, A, B,                                                                 \
			opi_triop(ctx, var_get(ctx, C, D), var_get(ctx, E, F), var_get(ctx, G, H),     \
				func, erop));                                                              \
		if (ctx->failed)                                                                   \
			RUNDONE(SINK_RUN_FAIL);

	while (ctx->pc < ops->size){
		ctx->lastpc = ctx->pc;
		switch ((op_enum)ops->bytes[ctx->pc]){
			case OP_NOP            : { //
				ctx->pc++;
			} break;

			case OP_MOVE           : { // [TGT], [SRC]
				LOAD_abcd();
				var_set(ctx, A, B, var_get(ctx, C, D));
			} break;

			case OP_INC            : { // [TGT/SRC]
				LOAD_ab();
				X = var_get(ctx, A, B);
				if (!sink_isnum(X))
					RUNDONE(opi_abortcstr(ctx, "Expecting number when incrementing"));
				var_set(ctx, A, B, sink_num(X.f + 1));
			} break;

			case OP_NIL            : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, SINK_NIL);
			} break;

			case OP_NUMP8          : { // [TGT], VALUE
				LOAD_abc();
				var_set(ctx, A, B, sink_num(C));
			} break;

			case OP_NUMN8          : { // [TGT], VALUE
				LOAD_abc();
				var_set(ctx, A, B, sink_num(C - 256));
			} break;

			case OP_NUMP16         : { // [TGT], [VALUE]
				LOAD_abcd();
				var_set(ctx, A, B, sink_num(C | (D << 8)));
			} break;

			case OP_NUMN16         : { // [TGT], [VALUE]
				LOAD_abcd();
				var_set(ctx, A, B, sink_num((C | (D << 8)) - 65536));
			} break;

			case OP_NUMP32         : { // [TGT], [[VALUE]]
				LOAD_abcdef();
				var_set(ctx, A, B, sink_num(
					((uint32_t)C) | (((uint32_t)D) << 8) |
					(((uint32_t)E) << 16) | (((uint32_t)F) << 24)
				));
			} break;

			case OP_NUMN32         : { // [TGT], [[VALUE]]
				LOAD_abcdef();
				var_set(ctx, A, B, sink_num(
					(double)(((uint32_t)C) | (((uint32_t)D) << 8) |
					(((uint32_t)E) << 16) | (((uint32_t)F) << 24)) - 4294967296.0
				));
			} break;

			case OP_NUMDBL         : { // [TGT], [[[VALUE]]]
				LOAD_abcdefghij();
				X.u = ((uint64_t)C) |
					(((uint64_t)D) << 8) |
					(((uint64_t)E) << 16) |
					(((uint64_t)F) << 24) |
					(((uint64_t)G) << 32) |
					(((uint64_t)H) << 40) |
					(((uint64_t)I) << 48) |
					(((uint64_t)J) << 56);
				if (isnan(X.f)) // make sure no screwy NaN's come in
					X = sink_num_nan();
				var_set(ctx, A, B, X);
			} break;

			case OP_STR            : { // [TGT], [[INDEX]]
				LOAD_abcdef();
				C = C + (D << 8) + (E << 16) + ((F << 23) * 2);
				if (ctx->prg->repl){
					list_byte s = ctx->prg->strTable->ptrs[C];
					var_set(ctx, A, B, sink_str_newblob(ctx, s->size, s->bytes));
				}
				else
					var_set(ctx, A, B, (sink_val){ .u = SINK_TAG_STR | C });
			} break;

			case OP_LIST           : { // [TGT], HINT
				LOAD_abc();
				if (C <= 0)
					var_set(ctx, A, B, sink_list_newempty(ctx));
				else{
					var_set(ctx, A, B,
						sink_list_newblobgive(ctx, 0, C, mem_alloc(sizeof(sink_val) * C)));
				}
			} break;

			case OP_ISNUM          : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				var_set(ctx, A, B, sink_bool(sink_isnum(X)));
			} break;

			case OP_ISSTR          : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				var_set(ctx, A, B, sink_bool(sink_isstr(X)));
			} break;

			case OP_ISLIST         : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				var_set(ctx, A, B, sink_bool(sink_islist(X)));
			} break;

			case OP_NOT            : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				var_set(ctx, A, B, sink_bool(sink_isfalse(X)));
			} break;

			case OP_SIZE           : { // [TGT], [SRC]
				LOAD_abcd();
				var_set(ctx, A, B, sink_num(opi_size(ctx, var_get(ctx, C, D))));
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
			} break;

			case OP_TONUM          : { // [TGT], [SRC]
				LOAD_abcd();
				var_set(ctx, A, B, opi_tonum(ctx, var_get(ctx, C, D)));
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
			} break;

			case OP_CAT            : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				bool listcat = C > 0;
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
					if (!sink_islist(p[D]))
						listcat = false;
				}
				if (listcat)
					var_set(ctx, A, B, opi_list_cat(ctx, C, p));
				else{
					var_set(ctx, A, B, opi_str_cat(ctx, C, p));
					if (ctx->failed)
						RUNDONE(SINK_RUN_FAIL);
				}
			} break;

			case OP_LT             : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				if (sink_isstr(X) && sink_isstr(Y)){
					if (X.u == Y.u)
						var_set(ctx, A, B, sink_bool(false));
					else{
						var_set(ctx, A, B,
							sink_bool(str_cmp(var_caststr(ctx, X), var_caststr(ctx, Y)) < 0));
					}
				}
				else if (sink_isnum(X) && sink_isnum(Y))
					var_set(ctx, A, B, sink_bool(X.f < Y.f));
				else
					RUNDONE(opi_abortcstr(ctx, "Expecting numbers or strings"));
			} break;

			case OP_LTE            : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				if (sink_isstr(X) && sink_isstr(Y)){
					if (X.u == Y.u)
						var_set(ctx, A, B, sink_bool(true));
					else{
						var_set(ctx, A, B,
							sink_bool(str_cmp(var_caststr(ctx, X), var_caststr(ctx, Y)) <= 0));
					}
				}
				else if (sink_isnum(X) && sink_isnum(Y))
					var_set(ctx, A, B, sink_bool(X.f <= Y.f));
				else
					RUNDONE(opi_abortcstr(ctx, "Expecting numbers or strings"));
			} break;

			case OP_NEQ            : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				var_set(ctx, A, B, sink_bool(!opi_equ(ctx, X, Y)));
			} break;

			case OP_EQU            : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				var_set(ctx, A, B, sink_bool(opi_equ(ctx, X, Y)));
			} break;

			case OP_GETAT          : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				if (!sink_islist(X) && !sink_isstr(X))
					RUNDONE(opi_abortcstr(ctx, "Expecting list or string when indexing"));
				Y = var_get(ctx, E, F);
				if (!sink_isnum(Y))
					RUNDONE(opi_abortcstr(ctx, "Expecting index to be number"));
				I = Y.f;
				if (sink_islist(X)){
					ls = var_castlist(ctx, X);
					if (I < 0)
						I += ls.size;
					if (I < 0 || I >= ls.size)
						var_set(ctx, A, B, SINK_NIL);
					else
						var_set(ctx, A, B, ls.vals[I]);
				}
				else{
					str = var_caststr(ctx, X);
					if (I < 0)
						I += str.size;
					if (I < 0 || I >= str.size)
						var_set(ctx, A, B, SINK_NIL);
					else
						var_set(ctx, A, B, sink_str_newblob(ctx, 1, &str.bytes[I]));
				}
			} break;

			case OP_SLICE          : { // [TGT], [SRC1], [SRC2], [SRC3]
				LOAD_abcdefgh();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				Z = var_get(ctx, G, H);
				if (sink_islist(X))
					var_set(ctx, A, B, opi_list_slice(ctx, X, Y, Z));
				else
					var_set(ctx, A, B, opi_str_slice(ctx, X, Y, Z));
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
			} break;

			case OP_SETAT          : { // [SRC1], [SRC2], [SRC3]
				LOAD_abcdef();
				X = var_get(ctx, A, B);
				if (!sink_islist(X))
					RUNDONE(opi_abortcstr(ctx, "Expecting list when setting index"));
				Y = var_get(ctx, C, D);
				if (!sink_isnum(Y))
					RUNDONE(opi_abortcstr(ctx, "Expecting index to be number"));
				list_st *ls2 = var_castmlist(ctx, X);
				A = (int)Y.f;
				if (A < 0)
					A += ls2->size;
				opi_list_pushnils(ctx, ls2, A + 1);
				if (A >= 0 && A < ls2->size)
					ls2->vals[A] = var_get(ctx, E, F);
			} break;

			case OP_SPLICE         : { // [SRC1], [SRC2], [SRC3], [SRC4]
				LOAD_abcdefgh();
				X = var_get(ctx, A, B);
				Y = var_get(ctx, C, D);
				Z = var_get(ctx, E, F);
				W = var_get(ctx, G, H);
				if (sink_islist(X))
					opi_list_splice(ctx, X, Y, Z, W);
				else if (sink_isstr(X))
					var_set(ctx, A, B, opi_str_splice(ctx, X, Y, Z, W));
				else
					RUNDONE(opi_abortcstr(ctx, "Expecting list or string when splicing"));
			} break;

			case OP_JUMP           : { // [[LOCATION]]
				LOAD_abcd();
				A = A + (B << 8) + (C << 16) + ((D << 23) * 2);
				if (ctx->prg->repl && A == -1){
					ctx->pc -= 5;
					RUNDONE(SINK_RUN_REPLMORE);
				}
				ctx->pc = A;
			} break;

			case OP_JUMPTRUE       : { // [SRC], [[LOCATION]]
				LOAD_abcdef();
				C = C + (D << 8) + (E << 16) + ((F << 23) * 2);
				if (!sink_isnil(var_get(ctx, A, B))){
					if (ctx->prg->repl && C == -1){
						ctx->pc -= 7;
						RUNDONE(SINK_RUN_REPLMORE);
					}
					ctx->pc = C;
				}
			} break;

			case OP_JUMPFALSE      : { // [SRC], [[LOCATION]]
				LOAD_abcdef();
				C = C + (D << 8) + (E << 16) + ((F << 23) * 2);
				if (sink_isnil(var_get(ctx, A, B))){
					if (ctx->prg->repl && C == -1){
						ctx->pc -= 7;
						RUNDONE(SINK_RUN_REPLMORE);
					}
					ctx->pc = C;
				}
			} break;

			case OP_CMDTAIL        : { //
				ccs s = list_ptr_pop(ctx->call_stk);
				lxs lx = ctx->lex_stk->ptrs[ctx->lex_index];
				ctx->lex_stk->ptrs[ctx->lex_index] = lx->next;
				lxs_release(ctx, lx);
				ctx->lex_index = s->lex_index;
				var_set(ctx, s->frame, s->index, SINK_NIL);
				ctx->pc = s->pc;
				ccs_release(ctx, s);
			} break;

			case OP_CALL           : { // [TGT], [[LOCATION]], ARGCOUNT, [ARGS]...
				LOAD_abcdefg();
				C = C + (D << 8) + (E << 16) + ((F << 23) * 2);
				if (C == -1){
					ctx->pc -= 8;
					RUNDONE(SINK_RUN_REPLMORE);
				}
				for (I = 0; I < G; I++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[I] = var_get(ctx, E, F);
				}
				list_ptr_push(ctx->call_stk, ccs_get(ctx, ctx->pc, A, B, ctx->lex_index));
				ctx->pc = C - 1;
				LOAD_abc();
				// A is OP_CMDHEAD
				if (C != 0xFF){
					if (G <= C){
						while (G < C)
							p[G++] = SINK_NIL;
						p[G] = sink_list_newempty(ctx);
					}
					else
						p[C] = sink_list_newblob(ctx, G - C, &p[C]);
					G = C + 1;
				}
				ctx->lex_index = B;
				while (ctx->lex_index >= ctx->lex_stk->size)
					list_ptr_push(ctx->lex_stk, NULL);
				ctx->lex_stk->ptrs[ctx->lex_index] =
					lxs_get(ctx, G, p, ctx->lex_stk->ptrs[ctx->lex_index]);
			} break;

			case OP_ISNATIVE       : { // [TGT], [[INDEX]]
				LOAD_abcdef();
				C = C + (D << 8) + (E << 16) + ((F << 23) * 2);
				native nat = NULL;
				if (ctx->prg->repl){
					// if REPL, then we need to search for the hash
					uint64_t hash = ctx->prg->keyTable->vals[C];
					for (int i = 0; i < ctx->natives->size; i++){
						native nat2 = ctx->natives->ptrs[i];
						if (nat2->hash == hash){
							nat = nat2;
							break;
						}
					}
				}
				else
					nat = ctx->natives->ptrs[C];
				var_set(ctx, A, B, sink_bool(nat != NULL && nat->f_native != NULL));
			} break;

			case OP_NATIVE         : { // [TGT], [[INDEX]], ARGCOUNT, [ARGS]...
				LOAD_abcdefg();
				for (I = 0; I < G; I++){
					J = ops->bytes[ctx->pc++]; H = ops->bytes[ctx->pc++];
					p[I] = var_get(ctx, J, H);
				}
				C = C + (D << 8) + (E << 16) + ((F << 23) * 2);
				native nat = NULL;
				if (ctx->prg->repl){
					// if REPL, then we need to search for the hash
					uint64_t hash = ctx->prg->keyTable->vals[C];
					for (int i = 0; i < ctx->natives->size; i++){
						native nat2 = ctx->natives->ptrs[i];
						if (nat2->hash == hash){
							nat = nat2;
							break;
						}
					}
				}
				else
					nat = ctx->natives->ptrs[C];
				if (nat == NULL || nat->f_native == NULL)
					RUNDONE(opi_abortcstr(ctx, "Native call not implemented"));
				GOTWAIT(nat->f_native(ctx, G, p, nat->natuser));
			} break;

			case OP_RETURN         : { // [SRC]
				if (ctx->call_stk->size <= 0)
					RUNDONE(opi_exit(ctx));
				LOAD_ab();
				X = var_get(ctx, A, B);
				ccs s = list_ptr_pop(ctx->call_stk);
				lxs lx = ctx->lex_stk->ptrs[ctx->lex_index];
				ctx->lex_stk->ptrs[ctx->lex_index] = lx->next;
				lxs_release(ctx, lx);
				ctx->lex_index = s->lex_index;
				var_set(ctx, s->frame, s->index, X);
				ctx->pc = s->pc;
				ccs_release(ctx, s);
			} break;

			case OP_RETURNTAIL     : { // [[LOCATION]], ARGCOUNT, [ARGS]...
				LOAD_abcde();
				A = A + (B << 8) + (C << 16) + ((D << 23) * 2);
				if (A == -1){
					ctx->pc -= 6;
					RUNDONE(SINK_RUN_REPLMORE);
				}
				for (I = 0; I < E; I++){
					G = ops->bytes[ctx->pc++]; H = ops->bytes[ctx->pc++];
					p[I] = var_get(ctx, G, H);
				}
				ctx->pc = A - 1;
				LOAD_abc();
				if (C != 0xFF){
					if (E <= C){
						while (E < C)
							p[E++] = SINK_NIL;
						p[E] = sink_list_newempty(ctx);
					}
					else
						p[C] = sink_list_newblob(ctx, E - C, &p[C]);
					E = C + 1;
				}
				lxs lx = ctx->lex_stk->ptrs[ctx->lex_index];
				lxs lx2 = lx->next;
				lxs_release(ctx, lx);
				ctx->lex_stk->ptrs[ctx->lex_index] = lxs_get(ctx, E, p, lx2);
			} break;

			case OP_RANGE          : { // [TGT], [SRC1], [SRC2], [SRC3]
				LOAD_abcdefgh();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				Z = var_get(ctx, G, H);
				if (!sink_isnum(X))
					RUNDONE(opi_abortcstr(ctx, "Expecting number for range"));
				if (sink_isnum(Y)){
					if (sink_isnil(Z))
						Z = sink_num(1);
					if (!sink_isnum(Z))
						RUNDONE(opi_abortcstr(ctx, "Expecting number for range step"));
					X = opi_range(ctx, X.f, Y.f, Z.f);
				}
				else if (sink_isnil(Y)){
					if (!sink_isnil(Z))
						RUNDONE(opi_abortcstr(ctx, "Expecting number for range stop"));
					X = opi_range(ctx, 0, X.f, 1);
				}
				else
					RUNDONE(opi_abortcstr(ctx, "Expecting number for range stop"));
				var_set(ctx, A, B, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
			} break;

			case OP_ORDER          : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				var_set(ctx, A, B, sink_num(opi_order(ctx, X, Y)));
			} break;

			case OP_SAY            : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				GOTWAIT(opi_say(ctx, C, p));
			} break;

			case OP_WARN           : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				GOTWAIT(opi_warn(ctx, C, p));
			} break;

			case OP_ASK            : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				GOTWAIT(opi_ask(ctx, C, p));
			} break;

			case OP_EXIT           : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				if (C > 0){
					for (D = 0; D < C; D++){
						E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
						p[D] = var_get(ctx, E, F);
					}
					opi_say(ctx, C, p);
					if (ctx->failed)
						RUNDONE(SINK_RUN_FAIL);
				}
				RUNDONE(opi_exit(ctx));
			} break;

			case OP_ABORT          : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				char *err = NULL;
				if (C > 0)
					err = (char *)opi_list_joinplain(ctx, C, p, 1, (const uint8_t *)" ", &A);
				RUNDONE(opi_abort(ctx, err));
			} break;

			case OP_STACKTRACE     : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, opi_stacktrace(ctx));
			} break;

			case OP_NUM_NEG        : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_neg, txt_num_neg)
			} break;

			case OP_NUM_ADD        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_num_add, txt_num_add)
			} break;

			case OP_NUM_SUB        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_num_sub, txt_num_sub)
			} break;

			case OP_NUM_MUL        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_num_mul, txt_num_mul)
			} break;

			case OP_NUM_DIV        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_num_div, txt_num_div)
			} break;

			case OP_NUM_MOD        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_num_mod, txt_num_mod)
			} break;

			case OP_NUM_POW        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_num_pow, txt_num_pow)
			} break;

			case OP_NUM_ABS        : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_abs, txt_num_abs)
			} break;

			case OP_NUM_SIGN       : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_sign, txt_num_sign)
			} break;

			case OP_NUM_MAX        : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				var_set(ctx, A, B, opi_num_max(ctx, C, p));
			} break;

			case OP_NUM_MIN        : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				var_set(ctx, A, B, opi_num_min(ctx, C, p));
			} break;

			case OP_NUM_CLAMP      : { // [TGT], [SRC1], [SRC2], [SRC3]
				INLINE_TRIOP(triop_num_clamp, txt_num_clamp)
			} break;

			case OP_NUM_FLOOR      : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_floor, txt_num_floor)
			} break;

			case OP_NUM_CEIL       : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_ceil, txt_num_ceil)
			} break;

			case OP_NUM_ROUND      : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_round, txt_num_round)
			} break;

			case OP_NUM_TRUNC      : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_trunc, txt_num_trunc)
			} break;

			case OP_NUM_NAN        : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, sink_num_nan());
			} break;

			case OP_NUM_INF        : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, sink_num_inf());
			} break;

			case OP_NUM_ISNAN      : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_isnan, txt_num_isnan)
			} break;

			case OP_NUM_ISFINITE   : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_isfinite, txt_num_isfinite)
			} break;

			case OP_NUM_SIN        : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_sin, txt_num_sin)
			} break;

			case OP_NUM_COS        : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_cos, txt_num_cos)
			} break;

			case OP_NUM_TAN        : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_tan, txt_num_tan)
			} break;

			case OP_NUM_ASIN       : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_asin, txt_num_asin)
			} break;

			case OP_NUM_ACOS       : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_acos, txt_num_acos)
			} break;

			case OP_NUM_ATAN       : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_atan, txt_num_atan)
			} break;

			case OP_NUM_ATAN2      : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_num_atan2, txt_num_atan)
			} break;

			case OP_NUM_LOG        : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_log, txt_num_log)
			} break;

			case OP_NUM_LOG2       : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_log2, txt_num_log)
			} break;

			case OP_NUM_LOG10      : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_log10, txt_num_log)
			} break;

			case OP_NUM_EXP        : { // [TGT], [SRC]
				INLINE_UNOP(unop_num_exp, txt_num_pow)
			} break;

			case OP_NUM_LERP       : { // [TGT], [SRC1], [SRC2], [SRC3]
				INLINE_TRIOP(triop_num_lerp, txt_num_lerp)
			} break;

			case OP_NUM_HEX        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP_T(binop_num_hex, txt_num_hex, LT_ALLOWNUM,
					LT_ALLOWNUM | LT_ALLOWNIL)
			} break;

			case OP_NUM_OCT        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP_T(binop_num_oct, txt_num_oct, LT_ALLOWNUM,
					LT_ALLOWNUM | LT_ALLOWNIL)
			} break;

			case OP_NUM_BIN        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP_T(binop_num_bin, txt_num_bin, LT_ALLOWNUM,
					LT_ALLOWNUM | LT_ALLOWNIL)
			} break;

			case OP_INT_NEW        : { // [TGT], [SRC]
				INLINE_UNOP(unop_int_new, txt_int_new)
			} break;

			case OP_INT_NOT        : { // [TGT], [SRC]
				INLINE_UNOP(unop_int_not, txt_int_not)
			} break;

			case OP_INT_AND        : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				X = opi_combop(ctx, C, p, binop_int_and, txt_int_and);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_INT_OR         : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				X = opi_combop(ctx, C, p, binop_int_or, txt_int_or);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_INT_XOR        : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				X = opi_combop(ctx, C, p, binop_int_xor, txt_int_xor);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_INT_SHL        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_int_shl, txt_int_shl)
			} break;

			case OP_INT_SHR        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_int_shr, txt_int_shr)
			} break;

			case OP_INT_SAR        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_int_sar, txt_int_shr)
			} break;

			case OP_INT_ADD        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_int_add, txt_num_add)
			} break;

			case OP_INT_SUB        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_int_sub, txt_num_sub)
			} break;

			case OP_INT_MUL        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_int_mul, txt_num_mul)
			} break;

			case OP_INT_DIV        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_int_div, txt_num_div)
			} break;

			case OP_INT_MOD        : { // [TGT], [SRC1], [SRC2]
				INLINE_BINOP(binop_int_mod, txt_num_mod)
			} break;

			case OP_INT_CLZ        : { // [TGT], [SRC]
				INLINE_UNOP(unop_int_clz, txt_int_clz)
			} break;

			case OP_INT_POP        : { // [TGT], [SRC]
				INLINE_UNOP(unop_int_pop, txt_int_pop)
			} break;

			case OP_INT_BSWAP      : { // [TGT], [SRC]
				INLINE_UNOP(unop_int_bswap, txt_int_bswap)
			} break;

			case OP_RAND_SEED      : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				if (sink_isnil(X))
					X.f = 0;
				else if (!sink_isnum(X))
					RUNDONE(opi_abortcstr(ctx, "Expecting number"));
				opi_rand_seed(ctx, X.f);
				var_set(ctx, A, B, SINK_NIL);
			} break;

			case OP_RAND_SEEDAUTO  : { // [TGT]
				LOAD_ab();
				opi_rand_seedauto(ctx);
				var_set(ctx, A, B, SINK_NIL);
			} break;

			case OP_RAND_INT       : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, sink_num(opi_rand_int(ctx)));
			} break;

			case OP_RAND_NUM       : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, sink_num(opi_rand_num(ctx)));
			} break;

			case OP_RAND_RANGE     : { // [TGT], [SRC1], [SRC2], [SRC3]
				LOAD_abcdefgh();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				Z = var_get(ctx, G, H);
				if (!sink_isnum(X))
					RUNDONE(opi_abortcstr(ctx, "Expecting number for rand.range"));
				if (sink_isnum(Y)){
					if (sink_isnil(Z))
						Z = sink_num(1);
					if (!sink_isnum(Z))
						RUNDONE(opi_abortcstr(ctx, "Expecting number for rand.range step"));
					X = opi_rand_range(ctx, X.f, Y.f, Z.f);
				}
				else if (sink_isnil(Y)){
					if (!sink_isnil(Z))
						RUNDONE(opi_abortcstr(ctx, "Expecting number for rand.range stop"));
					X = opi_rand_range(ctx, 0, X.f, 1);
				}
				else
					RUNDONE(opi_abortcstr(ctx, "Expecting number for rand.range stop"));
				var_set(ctx, A, B, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
			} break;

			case OP_RAND_GETSTATE  : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, opi_rand_getstate(ctx));
			} break;

			case OP_RAND_SETSTATE  : { // [TGT], [SRC]
				LOAD_abcd();
				opi_rand_setstate(ctx, var_get(ctx, C, D));
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, SINK_NIL);
			} break;

			case OP_RAND_PICK      : { // [TGT], [SRC]
				LOAD_abcd();
				X = opi_rand_pick(ctx, var_get(ctx, C, D));
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_RAND_SHUFFLE   : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				opi_rand_shuffle(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_NEW        : { // [TGT], ARGCOUNT, [ARGS]...
				LOAD_abc();
				for (D = 0; D < C; D++){
					E = ops->bytes[ctx->pc++]; F = ops->bytes[ctx->pc++];
					p[D] = var_get(ctx, E, F);
				}
				var_set(ctx, A, B, opi_str_new(ctx, C, p));
			} break;

			case OP_STR_SPLIT      : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_str_split(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_REPLACE    : { // [TGT], [SRC1], [SRC2], [SRC3]
				LOAD_abcdefgh();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				Z = var_get(ctx, G, H);
				X = opi_str_replace(ctx, X, Y, Z);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_BEGINS     : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = sink_bool(opi_str_begins(ctx, X, Y));
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_ENDS       : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = sink_bool(opi_str_ends(ctx, X, Y));
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_PAD        : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				if (sink_isnil(Y))
					Y.f = 0;
				else if (!sink_isnum(Y))
					RUNDONE(opi_abortcstr(ctx, "Expecting number"));
				X = opi_str_pad(ctx, X, Y.f);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_FIND       : { // [TGT], [SRC1], [SRC2], [SRC3]
				LOAD_abcdefgh();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				Z = var_get(ctx, G, H);
				X = opi_str_find(ctx, X, Y, Z);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_RFIND      : { // [TGT], [SRC1], [SRC2], [SRC3]
				LOAD_abcdefgh();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				Z = var_get(ctx, G, H);
				X = opi_str_rfind(ctx, X, Y, Z);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_LOWER      : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_str_lower(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_UPPER      : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_str_upper(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_TRIM       : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_str_trim(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_REV        : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_str_rev(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_REP        : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				if (sink_isnil(Y))
					Y.f = 0;
				else if (!sink_isnum(Y))
					RUNDONE(opi_abortcstr(ctx, "Expecting number"));
				X = opi_str_rep(ctx, X, Y.f);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_LIST       : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_str_list(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_BYTE       : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				if (sink_isnil(Y))
					Y.f = 0;
				else if (!sink_isnum(Y))
					RUNDONE(opi_abortcstr(ctx, "Expecting number"));
				X = opi_str_byte(ctx, X, Y.f);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STR_HASH       : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				if (sink_isnil(Y))
					Y.f = 0;
				else if (!sink_isnum(Y))
					RUNDONE(opi_abortcstr(ctx, "Expecting number"));
				X = opi_str_hash(ctx, X, Y.f);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_UTF8_VALID     : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				var_set(ctx, A, B, sink_bool(opi_utf8_valid(ctx, X)));
			} break;

			case OP_UTF8_LIST      : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_utf8_list(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_UTF8_STR       : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_utf8_str(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STRUCT_SIZE    : { // [TGT], [SRC]
				LOAD_abcd();
				var_set(ctx, A, B, opi_struct_size(ctx, var_get(ctx, C, D)));
			} break;

			case OP_STRUCT_STR     : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_struct_str(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STRUCT_LIST    : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_struct_list(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_STRUCT_ISLE    : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, sink_bool(opi_struct_isLE()));
			} break;

			case OP_LIST_NEW       : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_list_new(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_SHIFT     : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_list_shift(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_POP       : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_list_pop(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_PUSH      : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_list_push(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_UNSHIFT   : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_list_unshift(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_APPEND    : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_list_append(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_PREPEND   : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_list_prepend(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_FIND      : { // [TGT], [SRC1], [SRC2], [SRC3]
				LOAD_abcdefgh();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				Z = var_get(ctx, G, H);
				X = opi_list_find(ctx, X, Y, Z);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_RFIND     : { // [TGT], [SRC1], [SRC2], [SRC3]
				LOAD_abcdefgh();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				Z = var_get(ctx, G, H);
				X = opi_list_rfind(ctx, X, Y, Z);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_JOIN      : { // [TGT], [SRC1], [SRC2]
				LOAD_abcdef();
				X = var_get(ctx, C, D);
				Y = var_get(ctx, E, F);
				X = opi_list_join(ctx, X, Y);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_REV       : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_list_rev(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_STR       : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_list_str(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_SORT      : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				opi_list_sort(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_LIST_RSORT     : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				opi_list_rsort(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_PICKLE_JSON    : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_pickle_json(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_PICKLE_BIN     : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_pickle_bin(ctx, X);
				var_set(ctx, A, B, X);
			} break;

			case OP_PICKLE_VAL     : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_pickle_val(ctx, X);
				if (ctx->failed)
					RUNDONE(SINK_RUN_FAIL);
				var_set(ctx, A, B, X);
			} break;

			case OP_PICKLE_VALID   : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				E = opi_pickle_valid(ctx, X);
				var_set(ctx, A, B, E == 0 ? SINK_NIL : sink_num(E));
			} break;

			case OP_PICKLE_SIBLING : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				var_set(ctx, A, B, sink_bool(opi_pickle_sibling(ctx, X)));
			} break;

			case OP_PICKLE_CIRCULAR: { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				var_set(ctx, A, B, sink_bool(opi_pickle_circular(ctx, X)));
			} break;

			case OP_PICKLE_COPY    : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				X = opi_pickle_copy(ctx, X);
				var_set(ctx, A, B, X);
			} break;

			case OP_GC_GETLEVEL    : { // [TGT]
				LOAD_ab();
				var_set(ctx, A, B, sink_num(ctx->gc_level));
			} break;

			case OP_GC_SETLEVEL    : { // [TGT], [SRC]
				LOAD_abcd();
				X = var_get(ctx, C, D);
				if (!sink_isnum(X)){
					RUNDONE(
						opi_abortcstr(ctx, "Expecting one of gc.NONE, gc.DEFAULT, or gc.LOWMEM"));
				}
				J = (int)X.f;
				if (J != SINK_GC_NONE && J != SINK_GC_DEFAULT && J != SINK_GC_LOWMEM){
					RUNDONE(
						opi_abortcstr(ctx, "Expecting one of gc.NONE, gc.DEFAULT, or gc.LOWMEM"));
				}
				ctx->gc_level = J;
				context_gcleft(ctx, false);
				var_set(ctx, A, B, SINK_NIL);
			} break;

			case OP_GC_RUN         : { // [TGT]
				LOAD_ab();
				context_gc(ctx);
				var_set(ctx, A, B, SINK_NIL);
			} break;

			default: break;
		}
		if (ctx->gc_level != SINK_GC_NONE){
			ctx->gc_left--;
			if (ctx->gc_left <= 0)
				context_gc(ctx);
		}
		if (ctx->timeout > 0){
			ctx->timeout_left--;
			if (ctx->timeout_left <= 0){
				ctx->timeout_left = ctx->timeout;
				RUNDONE(SINK_RUN_TIMEOUT);
			}
		}
	}

	#undef LOAD_ab
	#undef LOAD_abc
	#undef LOAD_abcd
	#undef LOAD_abcde
	#undef LOAD_abcdef
	#undef LOAD_abcdefg
	#undef LOAD_abcdefgh
	#undef LOAD_abcdefghi
	#undef LOAD_abcdefghij
	#undef INLINE_UNOP
	#undef INLINE_BINOP
	#undef INLINE_TRIOP

	if (ctx->prg->repl)
		RUNDONE(SINK_RUN_REPLMORE);
	RUNDONE(opi_exit(ctx));
	#undef RUNDONE
}

//
// compiler
//

typedef struct filepos_node_struct filepos_node_st, *filepos_node;
struct filepos_node_struct {
	lex lx;
	list_ptr tks;
	list_ptr stmts;
	list_ptr pgstate;
	filepos_node next;
	filepos_st flp;
	bool wascr;
};

static filepos_node flpn_new(int fullfile, int basefile, filepos_node next){
	filepos_node flpn = mem_alloc(sizeof(filepos_node_st));
	flpn->lx = lex_new();
	flpn->tks = list_ptr_new(tok_free);
	flpn->pgstate = list_ptr_new(pgst_free);
	flpn->flp.fullfile = fullfile;
	flpn->flp.basefile = basefile;
	flpn->flp.line = 1;
	flpn->flp.chr = 1;
	flpn->wascr = false;
	flpn->next = next;
	return flpn;
}

static void flpn_free(filepos_node flpn){
	lex_free(flpn->lx);
	list_ptr_free(flpn->tks);
	list_ptr_free(flpn->pgstate);
	mem_free(flpn);
}

struct staticinc_struct {
	list_ptr name;
	list_byte type; // 0 = body, 1 = file
	list_ptr content;
};

static inline staticinc staticinc_new(){
	staticinc sinc = mem_alloc(sizeof(staticinc_st));
	sinc->name = list_ptr_new(NULL);
	sinc->type = list_byte_new();
	sinc->content = list_ptr_new(NULL);
	return sinc;
}

static inline void staticinc_addbody(staticinc sinc, const char *name, const char *body){
	list_ptr_push(sinc->name, (void *)name);
	list_byte_push(sinc->type, 0);
	list_ptr_push(sinc->content, (void *)body);
}

static inline void staticinc_addfile(staticinc sinc, const char *name, const char *file){
	list_ptr_push(sinc->name, (void *)name);
	list_byte_push(sinc->type, 1);
	list_ptr_push(sinc->content, (void *)file);
}

static inline void staticinc_free(staticinc sinc){
	list_ptr_free(sinc->name);
	list_byte_free(sinc->type);
	list_ptr_free(sinc->content);
	mem_free(sinc);
}

struct compiler_struct {
	staticinc sinc;
	parser pr;
	script scr; // not freed by compiler_free
	program prg; // not freed by compiler_free
	list_ptr paths; // not freed by compiler_free
	symtbl sym;
	filepos_node flpn;
	sink_inc_st inc;
	char *msg;
};

static inline int script_addfile(script scr, const char *file);

static compiler compiler_new(script scr, program prg, staticinc sinc, sink_inc_st inc,
	const char *file, list_ptr paths){
	compiler cmp = mem_alloc(sizeof(compiler_st));
	cmp->sinc = sinc;
	cmp->pr = parser_new();
	cmp->scr = scr;
	cmp->prg = prg;
	cmp->paths = paths;
	cmp->sym = symtbl_new(prg->repl);
	symtbl_loadStdlib(cmp->sym);
	cmp->flpn = flpn_new(script_addfile(scr, file), program_addfile(prg, file), NULL);
	cmp->inc = inc;
	cmp->msg = NULL;
	return cmp;
}

static inline void compiler_setmsg(compiler cmp, char *msg){
	if (cmp->msg)
		mem_free(cmp->msg);
	cmp->msg = msg;
}

static void compiler_reset(compiler cmp){
	compiler_setmsg(cmp, NULL);
	lex_reset(cmp->flpn->lx);
	parser_free(cmp->pr);
	cmp->pr = parser_new();

	list_ptr_free(cmp->flpn->tks);
	cmp->flpn->tks = list_ptr_new(tok_free);

	list_ptr_free(cmp->flpn->pgstate);
	cmp->flpn->pgstate = list_ptr_new(pgst_free);
}

static char *compiler_write(compiler cmp, int size, const uint8_t *bytes);
static char *compiler_closeLexer(compiler cmp);

static bool compiler_begininc(compiler cmp, list_ptr names, const char *file){
	cmp->flpn = flpn_new(
		script_addfile(cmp->scr, file), program_addfile(cmp->prg, file), cmp->flpn);
	if (names){
		char *smsg = symtbl_pushNamespace(cmp->sym, names);
		if (smsg){
			filepos_node del = cmp->flpn;
			cmp->flpn = cmp->flpn->next;
			flpn_free(del);
			compiler_setmsg(cmp, smsg);
			return false;
		}
	}
	return true;
}

typedef struct {
	compiler cmp;
	list_ptr names;
} compiler_fileres_user_st, *compiler_fileres_user;

static bool compiler_begininc_cfu(const char *file, compiler_fileres_user cfu){
	return compiler_begininc(cfu->cmp, cfu->names, file);
}

static void compiler_endinc(compiler cmp, bool ns){
	if (ns)
		symtbl_popNamespace(cmp->sym);
	filepos_node del = cmp->flpn;
	cmp->flpn = cmp->flpn->next;
	flpn_free(del);
}

static void compiler_endinc_cfu(bool success, const char *file, compiler_fileres_user cfu){
	if (success)
		compiler_closeLexer(cfu->cmp);
	compiler_endinc(cfu->cmp, cfu->names != NULL);
	if (!success && cfu->cmp->msg == NULL)
		compiler_setmsg(cfu->cmp, format("Failed to read file: %s", file));
}

static bool compiler_staticinc(compiler cmp, list_ptr names, const char *file, const char *body){
	if (!compiler_begininc(cmp, names, file))
		return false;
	char *err = compiler_write(cmp, (int)strlen(body), (const uint8_t *)body);
	if (err){
		compiler_endinc(cmp, names != NULL);
		return false;
	}
	err = compiler_closeLexer(cmp);
	compiler_endinc(cmp, names != NULL);
	if (err)
		return false;
	return true;
}

static bool compiler_dynamicinc(compiler cmp, list_ptr names, const char *file, const char *cwd){
	compiler_fileres_user_st cfu;
	cfu.cmp = cmp;
	cfu.names = names;
	bool res = fileres_read(cmp->scr, true, file, cwd,
		(f_fileres_begin_f)compiler_begininc_cfu, (f_fileres_end_f)compiler_endinc_cfu, &cfu);
	return res;
}

static char *compiler_process(compiler cmp){
	// generate statements
	list_ptr stmts = list_ptr_new(ast_free);
	while (cmp->flpn->tks->size > 0){
		while (cmp->flpn->tks->size > 0){
			tok tk = list_ptr_shift(cmp->flpn->tks);
			tok_print(tk);
			if (tk->type == TOK_ERROR){
				compiler_setmsg(cmp, program_errormsg(cmp->prg, tk->flp, tk->u.msg));
				tok_free(tk);
				list_ptr_free(stmts);
				return cmp->msg;
			}
			const char *pmsg = parser_add(cmp->pr, tk, stmts);
			if (pmsg){
				compiler_setmsg(cmp, program_errormsg(cmp->prg, tk->flp, pmsg));
				list_ptr_free(stmts);
				return cmp->msg;
			}
			if (stmts->size > 0 && ((ast)stmts->ptrs[stmts->size - 1])->type == AST_INCLUDE)
				break;
		}

		// process statements
		while (stmts->size > 0){
			ast stmt = list_ptr_shift(stmts);
			ast_print(stmt);

			if (stmt->type == AST_INCLUDE){
				// intercept include statements to process by the compiler
				for (int ii = 0; ii < stmt->u.incls->size; ii++){
					incl inc = stmt->u.incls->ptrs[ii];
					const char *file = (const char *)inc->file->bytes;

					// look if file matches a static include pseudo-file
					bool internal = false;
					for (int i = 0; i < cmp->sinc->name->size; i++){
						const char *sinc_name = cmp->sinc->name->ptrs[i];
						if (strcmp(file, sinc_name) == 0){
							internal = true;
							const char *sinc_content = cmp->sinc->content->ptrs[i];
							bool is_body = cmp->sinc->type->bytes[i] == 0;
							bool success;
							if (is_body)
								success = compiler_staticinc(cmp, inc->names, file, sinc_content);
							else{
								bool found = compiler_dynamicinc(cmp, inc->names, sinc_content,
									cmp->scr->curdir);
								if (!found && cmp->msg == NULL){
									compiler_setmsg(cmp,
										format("Failed to include: %s", file));
								}
								success = cmp->msg == NULL;
							}
							if (!success){
								ast_free(stmt);
								list_ptr_free(stmts);
								return cmp->msg;
							}
							break;
						}
					}

					if (!internal){
						const char *from = script_getfile(cmp->scr, stmt->flp.fullfile);
						char *cwd = NULL;
						if (from)
							cwd = pathjoin(from, "..", cmp->scr->posix);
						bool found = compiler_dynamicinc(cmp, inc->names, file, cwd);
						if (cwd)
							mem_free(cwd);
						if (!found && cmp->msg == NULL)
							compiler_setmsg(cmp, format("Failed to include: %s", file));
						if (cmp->msg){
							ast_free(stmt);
							list_ptr_free(stmts);
							return cmp->msg;
						}
					}
				}
			}
			else{
				list_ptr pgsl = cmp->flpn->pgstate;
				pgr_st pg = program_gen((pgen_st){
						.prg = cmp->prg,
						.sym = cmp->sym,
						.scr = cmp->scr,
						.from = stmt->flp.fullfile
					}, stmt,
					pgsl->size <= 0 ? NULL : ((pgst)pgsl->ptrs[pgsl->size - 1])->state,
					cmp->prg->repl && cmp->flpn->next == NULL && pgsl->size <= 0);
				symtbl_print(cmp->sym);
				switch (pg.type){
					case PGR_OK:
						break;
					case PGR_PUSH:
						list_ptr_push(pgsl, pg.u.push.pgs);
						break;
					case PGR_POP:
						pgst_free(list_ptr_pop(pgsl));
						break;
					case PGR_ERROR:
						compiler_setmsg(cmp,
							program_errormsg(cmp->prg, pg.u.error.flp, pg.u.error.msg));
						ast_free(stmt);
						mem_free(pg.u.error.msg);
						list_ptr_free(stmts);
						return cmp->msg;
					case PGR_FORVARS:
						// impossible
						assert(false);
						break;
				}
			}
			ast_free(stmt);
		}
	}
	list_ptr_free(stmts);
	return NULL;
}

static char *compiler_write(compiler cmp, int size, const uint8_t *bytes){
	filepos_node flpn = cmp->flpn;
	for (int i = 0; i < size; i++){
		lex_add(flpn->lx, flpn->flp, bytes[i], flpn->tks);
		if (bytes[i] == '\n'){
			if (!flpn->wascr){
				flpn->flp.line++;
				flpn->flp.chr = 1;
			}
			flpn->wascr = false;
		}
		else if (bytes[i] == '\r'){
			flpn->flp.line++;
			flpn->flp.chr = 1;
			flpn->wascr = true;
		}
		else{
			flpn->flp.chr++;
			flpn->wascr = false;
		}
	}
	return compiler_process(cmp);
}

static char *compiler_closeLexer(compiler cmp){
	lex_close(cmp->flpn->lx, cmp->flpn->flp, cmp->flpn->tks);
	return compiler_process(cmp);
}

static char *compiler_close(compiler cmp){
	if (cmp->msg)
		return cmp->msg;

	char *err = compiler_closeLexer(cmp);
	if (err)
		return err;

	const char *pmsg = parser_close(cmp->pr);
	if (pmsg){
		compiler_setmsg(cmp, program_errormsg(cmp->prg, cmp->flpn->flp, pmsg));
		return cmp->msg;
	}

	err = symtbl_popFrame(cmp->sym);
	if (err){
		compiler_setmsg(cmp, program_errormsg(cmp->prg, cmp->flpn->flp, err));
		mem_free(err);
		return cmp->msg;
	}

	return NULL;
}

static void compiler_free(compiler cmp){
	if (cmp->msg)
		mem_free(cmp->msg);
	parser_free(cmp->pr);
	symtbl_free(cmp->sym);
	filepos_node flpn = cmp->flpn;
	while (flpn){
		filepos_node del = flpn;
		flpn = flpn->next;
		flpn_free(del);
	}
	mem_free(cmp);
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//
// API
//
////////////////////////////////////////////////////////////////////////////////////////////////////

//
// script API
//

sink_scr sink_scr_new(sink_inc_st inc, const char *curdir, bool posix, bool repl){
	script sc = mem_alloc(sizeof(script_st));
	sc->user = NULL;
	sc->f_freeuser = NULL;
	sc->prg = program_new(posix, repl);
	sc->cmp = NULL;
	sc->sinc = staticinc_new();
	sc->cup = cleanup_new();
	sc->files = list_ptr_new(mem_free_func);
	sc->paths = list_ptr_new(mem_free_func);
	sc->inc = inc;
	sc->capture_write = NULL;
	sc->curdir = curdir ? format("%s", curdir) : NULL;
	sc->posix = posix;
	sc->file = NULL;
	sc->err = NULL;
	sc->mode = SCM_UNKNOWN;
	sc->binstate.buf = NULL;
	return sc;
}

static inline int script_addfile(script scr, const char *file){
	if (file == NULL)
		return -1;
	for (int i = 0; i < scr->files->size; i++){
		if (strcmp(scr->files->ptrs[i], file) == 0)
			return i;
	}
	list_ptr_push(scr->files, format("%s", file));
	return scr->files->size - 1;
}

static inline const char *script_getfile(script scr, int file){
	if (file < 0)
		return NULL;
	return scr->files->ptrs[file];
}

void sink_scr_addpath(sink_scr scr, const char *path){
	list_ptr_push(((script)scr)->paths, format("%s", path));
}

void sink_scr_incbody(sink_scr scr, const char *name, const char *body){
	staticinc_addbody(((script)scr)->sinc, name, body);
}

void sink_scr_incfile(sink_scr scr, const char *name, const char *file){
	staticinc_addfile(((script)scr)->sinc, name, file);
}

void sink_scr_cleanup(sink_scr scr, void *cuser, sink_free_f f_free){
	cleanup_add(((script)scr)->cup, cuser, f_free);
}

void sink_scr_setuser(sink_scr scr, void *user, sink_free_f f_freeuser){
	script scr2 = scr;
	if (scr2->f_freeuser)
		scr2->f_freeuser(scr2->user);
	scr2->user = user;
	scr2->f_freeuser = f_freeuser;
}

void *sink_scr_getuser(sink_scr scr){
	return ((script)scr)->user;
}

static bool sfr_begin(const char *file, script sc){
	if (sc->file){
		mem_free(sc->file);
		sc->file = NULL;
	}
	if (file)
		sc->file = format("%s", file);
	return true;
}

static inline void binary_validate(script sc){
	if (sc->err)
		return;
	if (sc->binstate.state == BIS_DONE){
		if (!program_validate(sc->prg))
			sc->err = format("Error: Invalid program code");
	}
	else
		sc->err = format("Error: Invalid end of file");
}

static inline void text_validate(script sc, bool close, bool resetonclose){
	if (sc->err && sc->prg->repl)
		compiler_reset(sc->cmp);
	if (close){
		char *err2 = compiler_close(sc->cmp);
		if (err2){
			if (sc->err)
				mem_free(sc->err);
			sc->err = format("Error: %s", err2);
		}
		if (resetonclose)
			compiler_reset(sc->cmp);
	}
}

static void sfr_end(bool success, const char *file, script sc){
	if (!success){
		if (sc->err)
			mem_free(sc->err);
		if (sc->cmp && sc->cmp->msg)
			sc->err = format("Error: %s", sc->cmp->msg);
		else
			sc->err = format("Error: Failed to read file: %s", file);
	}
	else{
		switch (sc->mode){
			case SCM_UNKNOWN:
				// empty file, do nothing
				break;
			case SCM_BINARY:
				binary_validate(sc);
				break;
			case SCM_TEXT:
				text_validate(sc, true, false);
				break;
		}
	}
}

bool sink_scr_loadfile(sink_scr scr, const char *file){
	script sc = scr;
	if (sc->err){
		mem_free(sc->err);
		sc->err = NULL;
	}
	bool read = fileres_read(sc, true, file, NULL,
		(f_fileres_begin_f)sfr_begin, (f_fileres_end_f)sfr_end, sc);
	if (!read && sc->err == NULL)
		sc->err = format("Error: Failed to read file: %s", file);
	return sc->err == NULL;
}

const char *sink_scr_getfile(sink_scr scr){
	return ((script)scr)->file;
}

const char *sink_scr_getcwd(sink_scr scr){
	return ((script)scr)->curdir;
}

// byte size of each section of the binary file
static const int BSZ_HEADER     = 28;
static const int BSZ_STR_HEAD   =  4;
static const int BSZ_KEY        =  8;
static const int BSZ_DEBUG_HEAD =  4;
static const int BSZ_POS        = 16;
static const int BSZ_CMD        =  8;

bool sink_scr_write(sink_scr scr, int size, const uint8_t *bytes){
	if (size <= 0)
		return true;
	script sc = scr;

	if (sc->capture_write){
		// the write operation is being captured by an embed, so append to the list_byte, and
		// return immediately
		list_byte_append(sc->capture_write, size, bytes);
		return true;
	}

	// sink binary files start with 0xFC (invalid UTF8 start byte), so we can tell if we're binary
	// just by looking at the first byte
	if (sc->mode == SCM_UNKNOWN){
		if (bytes[0] == 0xFC){
			sc->mode = SCM_BINARY;
			sc->binstate.state = BIS_HEADER;
			sc->binstate.left = BSZ_HEADER;
			sc->binstate.buf = list_byte_new();
		}
		else{
			sc->mode = SCM_TEXT;
			sc->cmp = compiler_new(sc, sc->prg, sc->sinc, sc->inc, sc->file, sc->paths);
		}
	}

	if (sc->mode == SCM_BINARY){
		if (sc->err){
			mem_free(sc->err);
			sc->err = NULL;
		}

		binstate_st *bs = &sc->binstate;
		program prg = sc->prg;

		// read a 4 byte integer (LE)
		#define GETINT(i)    (                               \
			(((uint32_t)bs->buf->bytes[(i) + 0])      ) |    \
			(((uint32_t)bs->buf->bytes[(i) + 1]) <<  8) |    \
			(((uint32_t)bs->buf->bytes[(i) + 2]) << 16) |    \
			(((uint32_t)bs->buf->bytes[(i) + 3]) << 24))

		// write to the buffer up to a certain total bytes (bs->left)
		#define WRITE()                                      \
			if (size > bs->left){                            \
				/* partial write to buf */                   \
				list_byte_append(bs->buf, bs->left, bytes);  \
				bytes += bs->left;                           \
				size -= bs->left;                            \
				bs->left = 0;                                \
			}                                                \
			else{                                            \
				/* full write to buf */                      \
				list_byte_append(bs->buf, size, bytes);      \
				bs->left -= size;                            \
				size = 0;                                    \
			}

		while (size > 0){
			switch (bs->state){
				case BIS_HEADER:
					WRITE()
					if (bs->left == 0){
						// finished reading entire header
						uint32_t magic = GETINT(0);
						bs->str_size = GETINT(4);
						bs->key_size = GETINT(8);
						bs->dbg_size = GETINT(12);
						bs->pos_size = GETINT(16);
						bs->cmd_size = GETINT(20);
						bs->ops_size = GETINT(24);
						if (magic != 0x016B53FC){
							sc->err = format("Error: Invalid binary header");
							return false;
						}
						debugf("binary header: strs %d, keys %d, dbgs %d, poss %d, cmds %d, ops %d",
							bs->str_size, bs->key_size, bs->dbg_size, bs->pos_size,
							bs->cmd_size, bs->ops_size);
						bs->state = BIS_STR_HEAD;
						bs->left = BSZ_STR_HEAD;
						bs->item = 0;
						bs->buf->size = 0;
					}
					break;
				case BIS_STR_HEAD:
					if (bs->item >= bs->str_size){
						bs->state = BIS_KEY;
						bs->left = BSZ_KEY;
						bs->item = 0;
						break;
					}
					WRITE()
					if (bs->left == 0){
						bs->state = BIS_STR_BODY;
						bs->left = GETINT(0);
						bs->buf->size = 0;
					}
					break;
				case BIS_STR_BODY: // variable
					WRITE()
					if (bs->left == 0){
						list_byte_null(bs->buf);
						debugf("str[%d] = \"%s\"", bs->item, (const char *)bs->buf->bytes);
						list_ptr_push(prg->strTable, bs->buf);
						bs->buf = list_byte_new();
						bs->state = BIS_STR_HEAD;
						bs->left = BSZ_STR_HEAD;
						bs->item++;
					}
					break;
				case BIS_KEY:
					if (bs->item >= bs->key_size){
						bs->state = BIS_DEBUG_HEAD;
						bs->left = BSZ_DEBUG_HEAD;
						bs->item = 0;
						break;
					}
					WRITE()
					if (bs->left == 0){
						uint64_t key =
							(((uint64_t)bs->buf->bytes[0])      ) |
							(((uint64_t)bs->buf->bytes[1]) <<  8) |
							(((uint64_t)bs->buf->bytes[2]) << 16) |
							(((uint64_t)bs->buf->bytes[3]) << 24) |
							(((uint64_t)bs->buf->bytes[4]) << 32) |
							(((uint64_t)bs->buf->bytes[5]) << 40) |
							(((uint64_t)bs->buf->bytes[6]) << 48) |
							(((uint64_t)bs->buf->bytes[7]) << 56);
						list_u64_push(prg->keyTable, key);
						debugf("key[%d] = %016llX", bs->item, key);
						bs->item++;
						bs->left = BSZ_KEY;
						bs->buf->size = 0;
					}
					break;
				case BIS_DEBUG_HEAD:
					if (bs->item >= bs->dbg_size){
						bs->state = BIS_POS;
						bs->left = BSZ_POS;
						bs->item = 0;
						break;
					}
					WRITE()
					if (bs->left == 0){
						bs->state = BIS_DEBUG_BODY;
						bs->left = GETINT(0);
						bs->buf->size = 0;
					}
					break;
				case BIS_DEBUG_BODY: // variable
					WRITE()
					if (bs->left == 0){
						list_byte_null(bs->buf);
						debugf("dbg[%d] = \"%s\"", bs->item, (const char *)bs->buf->bytes);
						list_ptr_push(prg->debugTable, list_byte_freetochar(bs->buf));
						bs->buf = list_byte_new();
						bs->state = BIS_DEBUG_HEAD;
						bs->left = BSZ_DEBUG_HEAD;
						bs->item++;
					}
					break;
				case BIS_POS:
					if (bs->item >= bs->pos_size){
						bs->state = BIS_CMD;
						bs->left = BSZ_CMD;
						bs->item = 0;
						break;
					}
					WRITE()
					if (bs->left == 0){
						prgflp p = mem_alloc(sizeof(prgflp_st));
						p->pc           = GETINT( 0);
						p->flp.line     = GETINT( 4);
						p->flp.chr      = GETINT( 8);
						p->flp.basefile = GETINT(12);
						p->flp.fullfile = -1;
						debugf("pos[%d] = pc %d, line %d, chr %d, bsf %d", bs->item,
							p->pc, p->flp.line, p->flp.chr, p->flp.basefile);
						list_ptr_push(prg->posTable, p);
						bs->buf->size = 0;
						bs->left = BSZ_POS;
						bs->item++;
						// silently validate basefile
						if (p->flp.basefile >= bs->dbg_size)
							p->flp.basefile = -1;
					}
					break;
				case BIS_CMD:
					if (bs->item >= bs->cmd_size){
						bs->state = BIS_OPS;
						bs->left = bs->ops_size + 1; // add 1 to read the terminating byte
						break;
					}
					WRITE()
					if (bs->left == 0){
						prgch p = mem_alloc(sizeof(prgch_st));
						p->pc      = GETINT(0);
						p->cmdhint = GETINT(4);
						debugf("cmd[%d] = pc %d, cmh %d", bs->item, p->pc, p->cmdhint);
						list_ptr_push(prg->cmdTable, p);
						bs->buf->size = 0;
						bs->left = BSZ_CMD;
						bs->item++;
						// silently validate cmdhint
						if (p->cmdhint >= bs->dbg_size)
							p->cmdhint = -1;
					}
					break;
				case BIS_OPS: // variable
					WRITE()
					if (bs->left == 0){
						// validate terminating byte
						if (bs->buf->bytes[bs->buf->size - 1] != 0xFD){
							sc->err = format("Error: Invalid binary file");
							return false;
						}
						bs->buf->size--; // trim off terminating byte
						list_byte_free(prg->ops);
						prg->ops = bs->buf;
						bs->buf = NULL;
						bs->state = BIS_DONE;
					}
					break;
				case BIS_DONE:
					sc->err = format("Error: Invalid data at end of file");
					return false;
			}
		}
		#undef GETINT
		#undef WRITE
		bool is_eval = !sc->prg->repl && sc->file == NULL;
		if (is_eval) // if we're evaling, then we're at the end of file right now
			binary_validate(sc);
		return sc->err == NULL;
	}
	else{
		if (sc->err){
			mem_free(sc->err);
			sc->err = NULL;
		}
		char *err = compiler_write(sc->cmp, size, bytes);
		if (err && sc->err == NULL)
			sc->err = format("Error: %s", err);
		bool is_eval = !sc->prg->repl && sc->file == NULL;
		text_validate(sc, is_eval, true);
		return sc->err == NULL;
	}
}

const char *sink_scr_geterr(sink_scr scr){
	return ((script)scr)->err;
}

int sink_scr_level(sink_scr scr){
	if (((script)scr)->mode != SCM_TEXT)
		return 0;
	return ((script)scr)->cmp->pr->level;
}

void sink_scr_dump(sink_scr scr, bool debug, void *user, sink_dump_f f_dump){
	// all integer values are little endian

	program prg = ((script)scr)->prg;

	// output header
	// 4 bytes: header: 0xFC, 'S', 'k', file format version (always 0x01)
	// 4 bytes: string table size
	// 4 bytes: key table size
	// 4 bytes: debug string table size
	// 4 bytes: pos table size
	// 4 bytes: cmd table size
	// 4 bytes: opcode size
	uint8_t header[28] = {0};
	header[ 0] = 0xFC;
	header[ 1] = 0x53;
	header[ 2] = 0x6B;
	header[ 3] = 0x01;
	header[ 4] = (prg->strTable->size            ) & 0xFF;
	header[ 5] = (prg->strTable->size       >>  8) & 0xFF;
	header[ 6] = (prg->strTable->size       >> 16) & 0xFF;
	header[ 7] = (prg->strTable->size       >> 24) & 0xFF;
	header[ 8] = (prg->keyTable->size            ) & 0xFF;
	header[ 9] = (prg->keyTable->size       >>  8) & 0xFF;
	header[10] = (prg->keyTable->size       >> 16) & 0xFF;
	header[11] = (prg->keyTable->size       >> 24) & 0xFF;
	if (debug){
		header[12] = (prg->debugTable->size      ) & 0xFF;
		header[13] = (prg->debugTable->size >>  8) & 0xFF;
		header[14] = (prg->debugTable->size >> 16) & 0xFF;
		header[15] = (prg->debugTable->size >> 24) & 0xFF;
		header[16] = (prg->posTable->size        ) & 0xFF;
		header[17] = (prg->posTable->size   >>  8) & 0xFF;
		header[18] = (prg->posTable->size   >> 16) & 0xFF;
		header[19] = (prg->posTable->size   >> 24) & 0xFF;
		header[20] = (prg->cmdTable->size        ) & 0xFF;
		header[21] = (prg->cmdTable->size   >>  8) & 0xFF;
		header[22] = (prg->cmdTable->size   >> 16) & 0xFF;
		header[23] = (prg->cmdTable->size   >> 24) & 0xFF;
	}
	header[24] = (prg->ops->size                 ) & 0xFF;
	header[25] = (prg->ops->size            >>  8) & 0xFF;
	header[26] = (prg->ops->size            >> 16) & 0xFF;
	header[27] = (prg->ops->size            >> 24) & 0xFF;
	f_dump(header, 1, 28, user);

	// output strTable
	// 4 bytes: string size
	// N bytes: raw string bytes
	for (int i = 0; i < prg->strTable->size; i++){
		list_byte str = prg->strTable->ptrs[i];
		uint8_t sizeb[4] = {
			(str->size      ) & 0xFF,
			(str->size >>  8) & 0xFF,
			(str->size >> 16) & 0xFF,
			(str->size >> 24) & 0xFF
		};
		f_dump(sizeb, 1, 4, user);
		if (str->size > 0)
			f_dump(str->bytes, 1, str->size, user);
	}

	// output keyTable
	// 8 bytes: hash identifier
	for (int i = 0; i < prg->keyTable->size; i++){
		uint64_t id = prg->keyTable->vals[i];
		uint8_t idb[8] = {
			(id      ) & 0xFF,
			(id >>  8) & 0xFF,
			(id >> 16) & 0xFF,
			(id >> 24) & 0xFF,
			(id >> 32) & 0xFF,
			(id >> 40) & 0xFF,
			(id >> 48) & 0xFF,
			(id >> 56) & 0xFF
		};
		f_dump(idb, 1, 8, user);
	}

	if (debug){
		// output debug strings
		// 4 bytes: string length
		// N bytes: string raw bytes
		for (int i = 0; i < prg->debugTable->size; i++){
			char *str = prg->debugTable->ptrs[i];
			size_t slen = str == NULL ? 4 : strlen(str);
			uint8_t slenb[4] = {
				(slen      ) & 0xFF,
				(slen >>  8) & 0xFF,
				(slen >> 16) & 0xFF,
				(slen >> 24) & 0xFF
			};
			f_dump(slenb, 1, 4, user);
			if (str == NULL)
				f_dump("eval", 1, 4, user);
			else if (slen > 0)
				f_dump(str, 1, slen, user);
		}

		// output pos table
		// 4 bytes: start PC
		// 4 bytes: line number
		// 4 bytes: character number
		// 4 bytes: filename debug string index
		for (int i = 0; i < prg->posTable->size; i++){
			prgflp p = prg->posTable->ptrs[i];
			// find unique filename entry
			uint8_t plcb[16] = {
				(p->pc                ) & 0xFF,
				(p->pc           >>  8) & 0xFF,
				(p->pc           >> 16) & 0xFF,
				(p->pc           >> 24) & 0xFF,
				(p->flp.line          ) & 0xFF,
				(p->flp.line     >>  8) & 0xFF,
				(p->flp.line     >> 16) & 0xFF,
				(p->flp.line     >> 24) & 0xFF,
				(p->flp.chr           ) & 0xFF,
				(p->flp.chr      >>  8) & 0xFF,
				(p->flp.chr      >> 16) & 0xFF,
				(p->flp.chr      >> 24) & 0xFF,
				(p->flp.basefile      ) & 0xFF,
				(p->flp.basefile >>  8) & 0xFF,
				(p->flp.basefile >> 16) & 0xFF,
				(p->flp.basefile >> 24) & 0xFF
			};
			f_dump(plcb, 1, 16, user);
		}

		// output cmd table
		// 4 bytes: return PC
		// 4 bytes: hint debug string index
		for (int i = 0; i < prg->cmdTable->size; i++){
			prgch p = prg->cmdTable->ptrs[i];
			uint8_t plcb[8] = {
				(p->pc            ) & 0xFF,
				(p->pc       >>  8) & 0xFF,
				(p->pc       >> 16) & 0xFF,
				(p->pc       >> 24) & 0xFF,
				(p->cmdhint       ) & 0xFF,
				(p->cmdhint  >>  8) & 0xFF,
				(p->cmdhint  >> 16) & 0xFF,
				(p->cmdhint  >> 24) & 0xFF
			};
			f_dump(plcb, 1, 8, user);
		}
	}

	// output ops
	// just the raw bytecode
	if (prg->ops->size > 0)
		f_dump(prg->ops->bytes, 1, prg->ops->size, user);

	// output terminating byte
	// single 0xFD byte which is an invalid op
	uint8_t end = 0xFD;
	f_dump(&end, 1, 1, user);
}

void sink_scr_free(sink_scr scr){
	script sc = scr;
	if (sc->f_freeuser)
		sc->f_freeuser(sc->user);
	cleanup_free(sc->cup);
	list_ptr_free(sc->files);
	list_ptr_free(sc->paths);
	program_free(sc->prg);
	staticinc_free(sc->sinc);
	if (sc->cmp)
		compiler_free(sc->cmp);
	if (sc->capture_write)
		list_byte_free(sc->capture_write);
	if (sc->curdir)
		mem_free(sc->curdir);
	if (sc->file)
		mem_free(sc->file);
	if (sc->err)
		mem_free(sc->err);
	if (sc->binstate.buf)
		list_byte_free(sc->binstate.buf);
	mem_free(sc);
	mem_done();
}

//
// context API
//

sink_ctx sink_ctx_new(sink_scr scr, sink_io_st io){
	return context_new(((script)scr)->prg, io);
}

sink_status sink_ctx_getstatus(sink_ctx ctx){
	context ctx2 = ctx;
	if (ctx2->passed)
		return SINK_PASSED;
	else if (ctx2->failed)
		return SINK_FAILED;
	else if (ctx2->async)
		return SINK_WAITING;
	return SINK_READY;
}

void sink_ctx_native(sink_ctx ctx, const char *name, void *natuser, sink_native_f f_native){
	context_native(ctx, native_hash((int)strlen(name), (const uint8_t *)name), natuser, f_native);
}

void sink_ctx_nativehash(sink_ctx ctx, uint64_t hash, void *natuser, sink_native_f f_native){
	context_native(ctx, hash, natuser, f_native);
}

void sink_ctx_cleanup(sink_ctx ctx, void *cuser, sink_free_f f_free){
	context_cleanup(ctx, cuser, f_free);
}

void sink_ctx_setuser(sink_ctx ctx, void *user, sink_free_f f_freeuser){
	context ctx2 = ctx;
	if (ctx2->f_freeuser)
		ctx2->f_freeuser(ctx2->user);
	ctx2->user = user;
	ctx2->f_freeuser = f_freeuser;
}

void *sink_ctx_getuser(sink_ctx ctx){
	return ((context)ctx)->user;
}

sink_user sink_ctx_addusertype(sink_ctx ctx, const char *hint, sink_free_f f_free){
	context ctx2 = ctx;
	list_ptr_push(ctx2->f_finalize, f_free);
	list_ptr_push(ctx2->user_hint, (void *)hint);
	return ctx2->f_finalize->size - 1;
}

sink_free_f sink_ctx_getuserfree(sink_ctx ctx, sink_user usertype){
	return ((context)ctx)->f_finalize->ptrs[usertype];
}

const char *sink_ctx_getuserhint(sink_ctx ctx, sink_user usertype){
	return ((context)ctx)->user_hint->ptrs[usertype];
}

void sink_ctx_settimeout(sink_ctx ctx, int timeout){
	context ctx2 = ctx;
	if (timeout < 0)
		timeout = 0;
	ctx2->timeout = timeout;
	ctx2->timeout_left = timeout;
}

int sink_ctx_gettimeout(sink_ctx ctx){
	return ((context)ctx)->timeout;
}

void sink_ctx_consumeticks(sink_ctx ctx, int amount){
	context ctx2 = ctx;
	if (amount > ctx2->timeout_left)
		amount = ctx2->timeout_left;
	if (amount < -ctx2->timeout)
		amount = -ctx2->timeout;
	ctx2->timeout_left -= amount;
	if (ctx2->timeout_left > ctx2->timeout)
		ctx2->timeout_left = ctx2->timeout;
}

void sink_ctx_forcetimeout(sink_ctx ctx){
	((context)ctx)->timeout_left = 0;
}

sink_wait sink_ctx_run(sink_ctx ctx){
	context ctx2 = ctx;
	if (ctx2->prg->repl && ctx2->err){
		mem_free(ctx2->err);
		ctx2->err = NULL;
	}
	return context_run(ctx2);
}

const char *sink_ctx_geterr(sink_ctx ctx){
	return ((context)ctx)->err;
}

void sink_ctx_free(sink_ctx ctx){
	context_free(ctx);
}

//
// wait API
//

sink_wait sink_waiter(sink_ctx ctx){
	waitt w = wait_get(ctx);
	wait_make(w, ctx);
	return w;
}

sink_wait sink_done(sink_ctx ctx, sink_val result){
	waitt w = wait_get(ctx);
	wait_make(w, ctx);
	w->has_result = true;
	w->result = result;
	context_gcpin(ctx, result); // pin the result so it won't be collected
	return w;
}

void sink_then(sink_wait w, sink_then_st then){
	waitt w2 = w;
	assert(!w2->has_then);
	w2->has_then = true;
	w2->then = then;
	if (w2->has_result)
		wait_fire(w2);
}

void sink_result(sink_wait w, sink_val result){
	waitt w2 = w;
	assert(!w2->has_result);
	w2->has_result = true;
	w2->result = result;
	context_gcpin(w2->ctx, result); // pin the result so it won't be collected
	if (w2->has_then)
		wait_fire(w2);
}

//
// cast/arg API
//

sink_str sink_caststr(sink_ctx ctx, sink_val str){
	str_st str2 = var_caststr(ctx, str);
	return (sink_str){ .size = str2.size, .bytes = str2.bytes };
}

sink_list sink_castlist(sink_ctx ctx, sink_val ls){
	list_st ls2 = var_castlist(ctx, ls);
	return (sink_list){ .size = ls2.size, .vals = ls2.vals };
}

bool sink_arg_bool(int size, const sink_val *args, int index){
	if (index < 0 || index >= size)
		return false;
	return sink_istrue(args[index]);
}

bool sink_arg_num(sink_ctx ctx, int size, const sink_val *args, int index, double *num){
	if (index < 0 || index >= size){
		*num = 0;
		return true;
	}
	if (sink_isnum(args[index])){
		*num = args[index].f;
		return true;
	}
	opi_abortformat(ctx, "Expecting number for item %d", index + 1);
	return false;
}

bool sink_arg_str(sink_ctx ctx, int size, const sink_val *args, int index, sink_str *str){
	if (index < 0 || index >= size || !sink_isstr(args[index])){
		opi_abortformat(ctx, "Expecting string for item %d", index + 1);
		return false;
	}
	*str = sink_caststr(ctx, args[index]);
	return true;
}

bool sink_arg_list(sink_ctx ctx, int size, const sink_val *args, int index, sink_list *ls){
	if (index < 0 || index >= size || !sink_islist(args[index])){
		opi_abortformat(ctx, "Expecting list for item %d", index + 1);
		return false;
	}
	*ls = sink_castlist(ctx, args[index]);
	return true;
}

bool sink_arg_user(sink_ctx ctx, int size, const sink_val *args, int index, sink_user usertype,
	void **user){
	context ctx2 = ctx;
	const char *hint = ctx2->user_hint->ptrs[usertype];

	if (index < 0 || index >= size || !sink_islist(args[index]) ||
		!sink_list_hasuser(ctx, args[index], usertype)){
		opi_abortformat(ctx, "Expecting user type%s%s for item %d",
			hint == NULL ? "" : " ", hint == NULL ? "" : hint, index + 1);
		return false;
	}
	*user = sink_list_getuser(ctx, args[index]);
	return true;
}

//
// sink commands API
//

sink_val sink_tonum(sink_ctx ctx, sink_val v){
	return opi_tonum(ctx, v);
}

static str_st sinkhelp_tostr(context ctx, list_int li, sink_val v){
	switch (sink_typeof(v)){
		case SINK_TYPE_NIL: {
			uint8_t *bytes = mem_alloc(sizeof(uint8_t) * 4);
			bytes[0] = 'n'; bytes[1] = 'i'; bytes[2] = 'l'; bytes[3] = 0;
			return (str_st){ .bytes = bytes, .size = 3 };
		} break;

		case SINK_TYPE_NUM: {
			if (isnan(v.f)){
				uint8_t *bytes = mem_alloc(sizeof(uint8_t) * 4);
				bytes[0] = 'n'; bytes[1] = 'a'; bytes[2] = 'n'; bytes[3] = 0;
				return (str_st){ .bytes = bytes, .size = 3 };
			}
			else if (isinf(v.f)){
				if (v.f < 0){
					uint8_t *bytes = mem_alloc(sizeof(uint8_t) * 5);
					bytes[0] = '-'; bytes[1] = 'i'; bytes[2] = 'n'; bytes[3] = 'f'; bytes[4] = 0;
					return (str_st){ .bytes = bytes, .size = 4 };
				}
				uint8_t *bytes = mem_alloc(sizeof(uint8_t) * 4);
				bytes[0] = 'i'; bytes[1] = 'n'; bytes[2] = 'f'; bytes[3] = 0;
				return (str_st){ .bytes = bytes, .size = 3 };
			}
			char buf[64];
			int size;
			numtostr(v.f, buf, sizeof(buf), &size);
			uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (size + 1));
			memcpy(bytes, buf, sizeof(uint8_t) * (size + 1));
			return (str_st){ .bytes = bytes, .size = size };
		} break;

		case SINK_TYPE_STR: {
			str_st s = var_caststr(ctx, v);
			int tot = 2;
			for (int i = 0; i < s.size; i++){
				if (s.bytes[i] == '\'')
					tot++;
				tot++;
			}
			uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
			bytes[0] = '\'';
			int p = 1;
			for (int i = 0; i < s.size; i++){
				if (s.bytes[i] == '\'')
					bytes[p++] = '\'';
				bytes[p++] = s.bytes[i];
			}
			bytes[p++] = '\'';
			bytes[tot] = 0;
			return (str_st){ .bytes = bytes, .size = tot };
		} break;

		case SINK_TYPE_LIST: {
			int idx = var_index(v);
			if (list_int_has(li, idx)){
				uint8_t *bytes = mem_alloc(sizeof(uint8_t) * 11);
				bytes[0] = '{'; bytes[1] = 'c'; bytes[2] = 'i'; bytes[3] = 'r'; bytes[4] = 'c';
				bytes[5] = 'u'; bytes[6] = 'l'; bytes[7] = 'a'; bytes[8] = 'r'; bytes[9] = '}';
				bytes[10] = 0;
				return (str_st){ .bytes = bytes, .size = 10 };
			}
			list_int_push(li, idx);
			list_st ls = var_castlist(ctx, v);
			int tot = 2;
			str_st *strs = mem_alloc(sizeof(str_st) * ls.size);
			for (int i = 0; i < ls.size; i++){
				str_st s = sinkhelp_tostr(ctx, li, ls.vals[i]);
				strs[i] = s;
				tot += (i == 0 ? 0 : 2) + s.size;
			}
			list_int_pop(li);
			uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
			bytes[0] = '{';
			int p = 1;
			for (int i = 0; i < ls.size; i++){
				if (i > 0){
					bytes[p++] = ',';
					bytes[p++] = ' ';
				}
				if (strs[i].bytes){
					memcpy(&bytes[p], strs[i].bytes, sizeof(uint8_t) * strs[i].size);
					mem_free(strs[i].bytes);
				}
				p += strs[i].size;
			}
			mem_free(strs);
			bytes[p] = '}';
			bytes[tot] = 0;
			return (str_st){ .bytes = bytes, .size = tot };
		} break;
	}
}

sink_val sink_tostr(sink_ctx ctx, sink_val v){
	if (sink_isstr(v))
		return v;
	list_int li = NULL;
	if (sink_islist(v))
		li = list_int_new();
	str_st s = sinkhelp_tostr(ctx, li, v);
	if (li)
		list_int_free(li);
	return sink_str_newblobgive(ctx, s.size, s.bytes);
}

int sink_size(sink_ctx ctx, sink_val v){
	return opi_size(ctx, v);
}

sink_wait sink_say(sink_ctx ctx, int size, sink_val *vals){
	return opi_say(ctx, size, vals);
}

sink_wait sink_warn(sink_ctx ctx, int size, sink_val *vals){
	return opi_warn(ctx, size, vals);
}

sink_wait sink_ask(sink_ctx ctx, int size, sink_val *vals){
	return opi_ask(ctx, size, vals);
}

void sink_exit(sink_ctx ctx){
	opi_exit(ctx);
}

void sink_abort(sink_ctx ctx, int size, sink_val *vals){
	uint8_t *bytes = NULL;
	if (size > 0){
		int tot;
		bytes = opi_list_joinplain(ctx, size, vals, 1, (const uint8_t *)" ", &tot);
	}
	opi_abort(ctx, (char *)bytes);
}

bool sink_isnative(sink_ctx ctx, const char *name){
	return sink_isnativehash(ctx, native_hash((int)strlen(name), (const uint8_t *)name));
}

bool sink_isnativehash(sink_ctx ctx, uint64_t hash){
	context ctx2 = ctx;
	for (int i = 0; i < ctx2->natives->size; i++){
		native nat = ctx2->natives->ptrs[i];
		if (nat->hash == hash && nat->f_native != NULL)
			return true;
	}
	return false;
}

sink_val sink_range(sink_ctx ctx, double start, double stop, double step){
	return opi_range(ctx, start, stop, step);
}

int sink_order(sink_ctx ctx, sink_val a, sink_val b){
	return opi_order(ctx, a, b);
}

sink_val sink_stacktrace(sink_ctx ctx){
	return opi_stacktrace(ctx);
}

// numbers
sink_val sink_num_neg(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_neg, txt_num_neg);
}

sink_val sink_num_add(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_add, txt_num_add, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_num_sub(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_sub, txt_num_sub, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_num_mul(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_mul, txt_num_mul, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_num_div(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_div, txt_num_div, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_num_mod(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_mod, txt_num_mod, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_num_pow(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_pow, txt_num_pow, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_num_abs(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_abs, txt_num_abs);
}

sink_val sink_num_sign(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_sign, txt_num_sign);
}

sink_val sink_num_max(sink_ctx ctx, int size, sink_val *vals){
	return opi_num_max(ctx, size, vals);
}

sink_val sink_num_min(sink_ctx ctx, int size, sink_val *vals){
	return opi_num_min(ctx, size, vals);
}

sink_val sink_num_clamp(sink_ctx ctx, sink_val a, sink_val b, sink_val c){
	return opi_triop(ctx, a, b, c, triop_num_clamp, txt_num_clamp);
}

sink_val sink_num_floor(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_floor, txt_num_floor);
}

sink_val sink_num_ceil(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_ceil, txt_num_ceil);
}

sink_val sink_num_round(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_round, txt_num_round);
}

sink_val sink_num_trunc(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_trunc, txt_num_trunc);
}

sink_val sink_num_sin(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_sin, txt_num_sin);
}

sink_val sink_num_cos(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_cos, txt_num_cos);
}

sink_val sink_num_tan(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_tan, txt_num_tan);
}

sink_val sink_num_asin(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_asin, txt_num_asin);
}

sink_val sink_num_acos(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_acos, txt_num_acos);
}

sink_val sink_num_atan(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_atan, txt_num_atan);
}

sink_val sink_num_atan2(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_atan2, txt_num_atan, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_num_log(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_log, txt_num_log);
}

sink_val sink_num_log2(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_log2, txt_num_log);
}

sink_val sink_num_log10(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_log10, txt_num_log);
}

sink_val sink_num_exp(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_num_exp, txt_num_pow);
}

sink_val sink_num_lerp(sink_ctx ctx, sink_val a, sink_val b, sink_val t){
	return opi_triop(ctx, a, b, t, triop_num_lerp, txt_num_lerp);
}

sink_val sink_num_hex(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_hex, txt_num_hex, LT_ALLOWNUM, LT_ALLOWNUM | LT_ALLOWNIL);
}

sink_val sink_num_oct(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_oct, txt_num_oct, LT_ALLOWNUM, LT_ALLOWNUM | LT_ALLOWNIL);
}

sink_val sink_num_bin(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_num_bin, txt_num_bin, LT_ALLOWNUM, LT_ALLOWNUM | LT_ALLOWNIL);
}

// integers
sink_val sink_int_new(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_int_new, txt_int_new);
}

sink_val sink_int_not(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_int_not, txt_int_not);
}

sink_val sink_int_and(sink_ctx ctx, int size, sink_val *vals){
	return opi_combop(ctx, size, vals, binop_int_and, txt_int_and);
}

sink_val sink_int_or(sink_ctx ctx, int size, sink_val *vals){
	return opi_combop(ctx, size, vals, binop_int_or, txt_int_or);
}

sink_val sink_int_xor(sink_ctx ctx, int size, sink_val *vals){
	return opi_combop(ctx, size, vals, binop_int_xor, txt_int_xor);
}

sink_val sink_int_shl(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_int_shl, txt_int_shl, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_int_shr(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_int_shr, txt_int_shr, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_int_sar(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_int_sar, txt_int_shr, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_int_add(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_int_add, txt_num_add, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_int_sub(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_int_sub, txt_num_sub, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_int_mul(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_int_mul, txt_num_mul, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_int_div(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_int_div, txt_num_div, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_int_mod(sink_ctx ctx, sink_val a, sink_val b){
	return opi_binop(ctx, a, b, binop_int_mod, txt_num_mod, LT_ALLOWNUM, LT_ALLOWNUM);
}

sink_val sink_int_clz(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_int_clz, txt_int_clz);
}

sink_val sink_int_pop(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_int_pop, txt_int_pop);
}

sink_val sink_int_bswap(sink_ctx ctx, sink_val a){
	return opi_unop(ctx, a, unop_int_bswap, txt_int_bswap);
}

// random
void sink_rand_seed(sink_ctx ctx, uint32_t a){
	opi_rand_seed(ctx, a);
}

void sink_rand_seedauto(sink_ctx ctx){
	opi_rand_seedauto(ctx);
}

uint32_t sink_rand_int(sink_ctx ctx){
	return opi_rand_int(ctx);
}

double sink_rand_num(sink_ctx ctx){
	return opi_rand_num(ctx);
}

sink_val sink_rand_range(sink_ctx ctx, double start, double stop, double step){
	return opi_rand_range(ctx, start, stop, step);
}

sink_val sink_rand_getstate(sink_ctx ctx){
	return opi_rand_getstate(ctx);
}

void sink_rand_setstate(sink_ctx ctx, sink_val a){
	opi_rand_setstate(ctx, a);
}

sink_val sink_rand_pick(sink_ctx ctx, sink_val ls){
	return opi_rand_pick(ctx, ls);
}

void sink_rand_shuffle(sink_ctx ctx, sink_val ls){
	opi_rand_shuffle(ctx, ls);
}

// strings
sink_val sink_str_newcstr(sink_ctx ctx, const char *str){
	return sink_str_newblob(ctx, (int)strlen(str), (const uint8_t *)str);
}

sink_val sink_str_newcstrgive(sink_ctx ctx, char *str){
	return sink_str_newblobgive(ctx, (int)strlen(str), (uint8_t *)str);
}

sink_val sink_str_newblob(sink_ctx ctx, int size, const uint8_t *bytes){
	uint8_t *copy = NULL;
	if (size > 0){
		copy = mem_alloc(sizeof(uint8_t) * (size + 1));
		memcpy(copy, bytes, sizeof(uint8_t) * size);
		copy[size] = 0;
	}
	return sink_str_newblobgive(ctx, size, copy);
}

sink_val sink_str_newblobgive(sink_ctx ctx, int size, uint8_t *bytes){
	if (!((bytes == NULL && size == 0) || bytes[size] == 0)){
		opi_abortcstr(ctx,
			"Native run-time error: sink_str_newblobgive() must either be given a NULL buffer of "
			"size 0, or the buffer must terminate with a 0");
		if (bytes)
			mem_free(bytes);
		return SINK_NIL;
	}
	context ctx2 = ctx;
	int index = bmp_reserve((void **)&ctx2->str_tbl, &ctx2->str_size, &ctx2->str_aloc,
		&ctx2->str_ref, sizeof(str_st));
	ctx2->str_tbl[index].bytes = bytes;
	ctx2->str_tbl[index].size = size;
	return (sink_val){ .u = SINK_TAG_STR | index };
}

sink_val sink_str_newformat(sink_ctx ctx, const char *fmt, ...){
	va_list args, args2;
	va_start(args, fmt);
	va_copy(args2, args);
	size_t s = vsnprintf(NULL, 0, fmt, args);
	char *buf = mem_alloc(s + 1);
	vsprintf_s(buf, s + 1, fmt, args2);
	va_end(args);
	va_end(args2);
	return sink_str_newblobgive(ctx, (int)s, (uint8_t *)buf);
}

sink_val sink_str_new(sink_ctx ctx, int size, sink_val *vals){
	return opi_str_new(ctx, size, vals);
}

sink_val sink_str_cat(sink_ctx ctx, int size, sink_val *vals){
	return opi_str_cat(ctx, size, vals);
}

sink_val sink_str_slice(sink_ctx ctx, sink_val a, sink_val start, sink_val len){
	return opi_str_slice(ctx, a, start, len);
}

sink_val sink_str_splice(sink_ctx ctx, sink_val a, sink_val start, sink_val len, sink_val b){
	return opi_str_splice(ctx, a, start, len, b);
}

sink_val sink_str_split(sink_ctx ctx, sink_val a, sink_val b){
	return opi_str_split(ctx, a, b);
}

sink_val sink_str_replace(sink_ctx ctx, sink_val a, sink_val b, sink_val c){
	return opi_str_replace(ctx, a, b, c);
}

bool sink_str_begins(sink_ctx ctx, sink_val a, sink_val b){
	return opi_str_begins(ctx, a, b);
}

bool sink_str_ends(sink_ctx ctx, sink_val a, sink_val b){
	return opi_str_ends(ctx, a, b);
}

sink_val sink_str_pad(sink_ctx ctx, sink_val a, int b){
	return opi_str_pad(ctx, a, b);
}

sink_val sink_str_find(sink_ctx ctx, sink_val a, sink_val b, sink_val c){
	return opi_str_find(ctx, a, b, c);
}

sink_val sink_str_rfind(sink_ctx ctx, sink_val a, sink_val b, sink_val c){
	return opi_str_rfind(ctx, a, b, c);
}

sink_val sink_str_lower(sink_ctx ctx, sink_val a){
	return opi_str_lower(ctx, a);
}

sink_val sink_str_upper(sink_ctx ctx, sink_val a){
	return opi_str_upper(ctx, a);
}

sink_val sink_str_trim(sink_ctx ctx, sink_val a){
	return opi_str_trim(ctx, a);
}

sink_val sink_str_rev(sink_ctx ctx, sink_val a){
	return opi_str_rev(ctx, a);
}

sink_val sink_str_rep(sink_ctx ctx, sink_val a, int rep){
	return opi_str_rep(ctx, a, rep);
}

sink_val sink_str_list(sink_ctx ctx, sink_val a){
	return opi_str_list(ctx, a);
}

sink_val sink_str_byte(sink_ctx ctx, sink_val a, int b){
	return sink_str_byte(ctx, a, b);
}

sink_val sink_str_hash(sink_ctx ctx, sink_val a, uint32_t seed){
	return opi_str_hash(ctx, a, seed);
}

static inline uint64_t rotl64(uint64_t x, int8_t r){
	return (x << r) | (x >> (64 - r));
}

static inline uint64_t fmix64(uint64_t k){
	k ^= k >> 33;
	k *= UINT64_C(0xFF51AFD7ED558CCD);
	k ^= k >> 33;
	k *= UINT64_C(0xC4CEB9FE1A85EC53);
	k ^= k >> 33;
	return k;
}

static inline void hash_le(int size, const uint8_t *str, uint32_t seed, uint32_t *out){
	// MurmurHash3 was written by Austin Appleby, and is placed in the public
	// domain. The author hereby disclaims copyright to this source code.
	// https://github.com/aappleby/smhasher
	uint64_t nblocks = size >> 4;
	uint64_t h1 = seed;
	uint64_t h2 = seed;
	uint64_t c1 = UINT64_C(0x87C37B91114253D5);
	uint64_t c2 = UINT64_C(0x4CF5AD432745937F);

	const uint64_t *blocks = (const uint64_t *)str;

	for (uint64_t i = 0; i < nblocks; i++){
		uint64_t k1 = blocks[i * 2 + 0];
		uint64_t k2 = blocks[i * 2 + 1];

		k1 *= c1;
		k1 = rotl64(k1, 31);
		k1 *= c2;
		h1 ^= k1;

		h1 = rotl64(h1, 27);
		h1 += h2;
		h1 = h1 * 5 + 0x52DCE729;

		k2 *= c2;
		k2 = rotl64(k2, 33);
		k2 *= c1;
		h2 ^= k2;

		h2 = rotl64(h2, 31);
		h2 += h1;
		h2 = h2 * 5 + 0x38495AB5;
	}

	const uint8_t *tail = &str[nblocks << 4];

	uint64_t k1 = 0;
	uint64_t k2 = 0;

	switch(size & 15) {
		case 15: k2 ^= (uint64_t)(tail[14]) << 48;
		case 14: k2 ^= (uint64_t)(tail[13]) << 40;
		case 13: k2 ^= (uint64_t)(tail[12]) << 32;
		case 12: k2 ^= (uint64_t)(tail[11]) << 24;
		case 11: k2 ^= (uint64_t)(tail[10]) << 16;
		case 10: k2 ^= (uint64_t)(tail[ 9]) << 8;
		case  9: k2 ^= (uint64_t)(tail[ 8]) << 0;

			k2 *= c2;
			k2 = rotl64(k2, 33);
			k2 *= c1;
			h2 ^= k2;

		case  8: k1 ^= (uint64_t)(tail[ 7]) << 56;
		case  7: k1 ^= (uint64_t)(tail[ 6]) << 48;
		case  6: k1 ^= (uint64_t)(tail[ 5]) << 40;
		case  5: k1 ^= (uint64_t)(tail[ 4]) << 32;
		case  4: k1 ^= (uint64_t)(tail[ 3]) << 24;
		case  3: k1 ^= (uint64_t)(tail[ 2]) << 16;
		case  2: k1 ^= (uint64_t)(tail[ 1]) << 8;
		case  1: k1 ^= (uint64_t)(tail[ 0]) << 0;

			k1 *= c1;
			k1 = rotl64(k1, 31);
			k1 *= c2;
			h1 ^= k1;
	}

	h1 ^= size;
	h2 ^= size;

	h1 += h2;
	h2 += h1;

	h1 = fmix64(h1);
	h2 = fmix64(h2);

	h1 += h2;
	h2 += h1;

	out[0] = h1 & 0xFFFFFFFF;
	out[1] = h1 >> 32;
	out[2] = h2 & 0xFFFFFFFF;
	out[3] = h2 >> 32;
}

static inline void hash_be(int size, const uint8_t *str, uint32_t seed, uint32_t *out){
	// big-endian version of hash_le... annoyed I can't detect this with a macro at compile-time,
	// but oh well
	uint64_t nblocks = size >> 4;
	uint64_t h1 = seed;
	uint64_t h2 = seed;
	uint64_t c1 = UINT64_C(0x87C37B91114253D5);
	uint64_t c2 = UINT64_C(0x4CF5AD432745937F);

	for (uint64_t i = 0; i < nblocks; i++){
		uint64_t ki = i * 16;
		uint64_t k1 =
			((uint64_t)str[ki +  0]      ) |
			((uint64_t)str[ki +  1] <<  8) |
			((uint64_t)str[ki +  2] << 16) |
			((uint64_t)str[ki +  3] << 24) |
			((uint64_t)str[ki +  4] << 32) |
			((uint64_t)str[ki +  5] << 40) |
			((uint64_t)str[ki +  6] << 48) |
			((uint64_t)str[ki +  7] << 56);
		uint64_t k2 =
			((uint64_t)str[ki +  8]      ) |
			((uint64_t)str[ki +  9] <<  8) |
			((uint64_t)str[ki + 10] << 16) |
			((uint64_t)str[ki + 11] << 24) |
			((uint64_t)str[ki + 12] << 32) |
			((uint64_t)str[ki + 13] << 40) |
			((uint64_t)str[ki + 14] << 48) |
			((uint64_t)str[ki + 15] << 56);

		k1 *= c1;
		k1 = rotl64(k1, 31);
		k1 *= c2;
		h1 ^= k1;

		h1 = rotl64(h1, 27);
		h1 += h2;
		h1 = h1 * 5 + 0x52DCE729;

		k2 *= c2;
		k2 = rotl64(k2, 33);
		k2 *= c1;
		h2 ^= k2;

		h2 = rotl64(h2, 31);
		h2 += h1;
		h2 = h2 * 5 + 0x38495AB5;
	}

	const uint8_t *tail = &str[nblocks << 4];

	uint64_t k1 = 0;
	uint64_t k2 = 0;

	switch(size & 15) {
		case 15: k2 ^= (uint64_t)(tail[14]) << 48;
		case 14: k2 ^= (uint64_t)(tail[13]) << 40;
		case 13: k2 ^= (uint64_t)(tail[12]) << 32;
		case 12: k2 ^= (uint64_t)(tail[11]) << 24;
		case 11: k2 ^= (uint64_t)(tail[10]) << 16;
		case 10: k2 ^= (uint64_t)(tail[ 9]) << 8;
		case  9: k2 ^= (uint64_t)(tail[ 8]) << 0;

			k2 *= c2;
			k2 = rotl64(k2, 33);
			k2 *= c1;
			h2 ^= k2;

		case  8: k1 ^= (uint64_t)(tail[ 7]) << 56;
		case  7: k1 ^= (uint64_t)(tail[ 6]) << 48;
		case  6: k1 ^= (uint64_t)(tail[ 5]) << 40;
		case  5: k1 ^= (uint64_t)(tail[ 4]) << 32;
		case  4: k1 ^= (uint64_t)(tail[ 3]) << 24;
		case  3: k1 ^= (uint64_t)(tail[ 2]) << 16;
		case  2: k1 ^= (uint64_t)(tail[ 1]) << 8;
		case  1: k1 ^= (uint64_t)(tail[ 0]) << 0;

			k1 *= c1;
			k1 = rotl64(k1, 31);
			k1 *= c2;
			h1 ^= k1;
	}

	h1 ^= size;
	h2 ^= size;

	h1 += h2;
	h2 += h1;

	h1 = fmix64(h1);
	h2 = fmix64(h2);

	h1 += h2;
	h2 += h1;

	out[0] = h1 & 0xFFFFFFFF;
	out[1] = h1 >> 32;
	out[2] = h2 & 0xFFFFFFFF;
	out[3] = h2 >> 32;
}

void sink_str_hashplain(int size, const uint8_t *str, uint32_t seed, uint32_t *out){
	const uint_least16_t v = 1;
	const uint8_t *vp = (const uint8_t *)&v;
	if (*vp) // is this machine little-endian?
		hash_le(size, str, seed, out);
	else
		hash_be(size, str, seed, out);
}

// utf8
bool sink_utf8_valid(sink_ctx ctx, sink_val a){
	return opi_utf8_valid(ctx, a);
}

sink_val sink_utf8_list(sink_ctx ctx, sink_val a){
	return opi_utf8_list(ctx, a);
}

sink_val sink_utf8_str(sink_ctx ctx, sink_val a){
	return opi_utf8_str(ctx, a);
}


// structs
sink_val sink_struct_size(sink_ctx ctx, sink_val tpl){
	return opi_struct_size(ctx, tpl);
}

sink_val sink_struct_str(sink_ctx ctx, sink_val ls, sink_val tpl){
	return opi_struct_str(ctx, ls, tpl);
}

sink_val sink_struct_list(sink_ctx ctx, sink_val a, sink_val tpl){
	return opi_struct_list(ctx, a, tpl);
}

bool sink_struct_isLE(){
	return opi_struct_isLE();
}

// lists
void sink_list_setuser(sink_ctx ctx, sink_val ls, sink_user usertype, void *user){
	assert(sink_islist(ls));
	list_st *ls2 = var_castmlist(ctx, ls);
	if (ls2->usertype >= 0){
		sink_free_f f_free = ((context)ctx)->f_finalize->ptrs[ls2->usertype];
		if (f_free)
			f_free(ls2->user);
	}
	ls2->usertype = usertype;
	ls2->user = user;
}

bool sink_list_hasuser(sink_ctx ctx, sink_val ls, sink_user usertype){
	if (!sink_islist(ls))
		return false;
	list_st ls2 = var_castlist(ctx, ls);
	return ls2.usertype == usertype;
}

void *sink_list_getuser(sink_ctx ctx, sink_val ls){
	if (!sink_islist(ls))
		return NULL;
	list_st ls2 = var_castlist(ctx, ls);
	return ls2.user;
}

sink_val sink_list_newblob(sink_ctx ctx, int size, const sink_val *vals){
	int count = size + sink_list_grow;
	sink_val *copy = mem_alloc(sizeof(sink_val) * count);
	if (size > 0)
		memcpy(copy, vals, sizeof(sink_val) * size);
	return sink_list_newblobgive(ctx, size, count, copy);
}

sink_val sink_list_newblobgive(sink_ctx ctx, int size, int count, sink_val *vals){
	if (vals == NULL || count == 0){
		opi_abortcstr(ctx,
			"Native run-time error: sink_list_newblobgive() must be given a buffer with some "
			"positive count");
		if (vals)
			mem_free(vals);
		return SINK_NIL;
	}
	context ctx2 = ctx;
	int index = bmp_reserve((void **)&ctx2->list_tbl, &ctx2->list_size, &ctx2->list_aloc,
		&ctx2->list_ref, sizeof(list_st));
	list_st *ls = &ctx2->list_tbl[index];
	ls->vals = vals;
	ls->size = size;
	ls->count = count;
	ls->user = NULL;
	ls->usertype = -1;
	return (sink_val){ .u = SINK_TAG_LIST | index };
}

sink_val sink_list_new(sink_ctx ctx, sink_val a, sink_val b){
	return opi_list_new(ctx, a, b);
}

sink_val sink_list_cat(sink_ctx ctx, int size, sink_val *vals){
	for (int i = 0; i < size; i++){
		if (!sink_islist(vals[i])){
			opi_abortcstr(ctx, "Cannot concatenate non-lists");
			return SINK_NIL;
		}
	}
	return opi_list_cat(ctx, size, vals);
}

sink_val sink_list_slice(sink_ctx ctx, sink_val ls, sink_val start, sink_val len){
	return opi_list_slice(ctx, ls, start, len);
}

void sink_list_splice(sink_ctx ctx, sink_val ls, sink_val start, sink_val len, sink_val ls2){
	opi_list_splice(ctx, ls, start, len, ls2);
}

sink_val sink_list_shift(sink_ctx ctx, sink_val ls){
	return opi_list_shift(ctx, ls);
}

sink_val sink_list_pop(sink_ctx ctx, sink_val ls){
	return opi_list_pop(ctx, ls);
}

void sink_list_push(sink_ctx ctx, sink_val ls, sink_val a){
	opi_list_push(ctx, ls, a);
}

void sink_list_unshift(sink_ctx ctx, sink_val ls, sink_val a){
	opi_list_unshift(ctx, ls, a);
}

void sink_list_append(sink_ctx ctx, sink_val ls, sink_val ls2){
	opi_list_append(ctx, ls, ls2);
}

void sink_list_prepend(sink_ctx ctx, sink_val ls, sink_val ls2){
	opi_list_prepend(ctx, ls, ls2);
}

sink_val sink_list_find(sink_ctx ctx, sink_val ls, sink_val a, sink_val b){
	return opi_list_find(ctx, ls, a, b);
}

sink_val sink_list_rfind(sink_ctx ctx, sink_val ls, sink_val a, sink_val b){
	return opi_list_rfind(ctx, ls, a, b);
}

sink_val sink_list_join(sink_ctx ctx, sink_val ls, sink_val a){
	return opi_list_join(ctx, ls, a);
}

static inline uint8_t *opi_list_joinplain(sink_ctx ctx, int size, const sink_val *vals, int sepz,
	const uint8_t *sep, int *totv){
	sink_val *strs = mem_alloc(sizeof(sink_val) * size);
	int tot = 0;
	for (int i = 0; i < size; i++){
		if (i > 0)
			tot += sepz;
		strs[i] = sink_tostr(ctx, vals[i]);
		str_st s = var_caststr(ctx, strs[i]);
		tot += s.size;
	}
	uint8_t *bytes = mem_alloc(sizeof(uint8_t) * (tot + 1));
	int nb = 0;
	for (int i = 0; i < size; i++){
		if (i > 0 && sepz > 0){
			memcpy(&bytes[nb], sep, sizeof(uint8_t) * sepz);
			nb += sepz;
		}
		str_st s = var_caststr(ctx, strs[i]);
		if (s.size > 0){
			memcpy(&bytes[nb], s.bytes, sizeof(uint8_t) * s.size);
			nb += s.size;
		}
	}
	mem_free(strs);
	bytes[tot] = 0;
	*totv = tot;
	return bytes;
}

sink_val sink_list_joinplain(sink_ctx ctx, int size, const sink_val *vals, int sepz,
	const uint8_t *sep){
	if (size <= 0)
		return sink_str_newblobgive(ctx, 0, NULL);
	int tot;
	uint8_t *bytes = opi_list_joinplain(ctx, size, vals, sepz, sep, &tot);
	return sink_str_newblobgive(ctx, tot, bytes);
}

void sink_list_rev(sink_ctx ctx, sink_val ls){
	opi_list_rev(ctx, ls);
}

sink_val sink_list_str(sink_ctx ctx, sink_val ls){
	return opi_list_str(ctx, ls);
}

void sink_list_sort(sink_ctx ctx, sink_val ls){
	opi_list_sort(ctx, ls);
}

void sink_list_rsort(sink_ctx ctx, sink_val ls){
	opi_list_rsort(ctx, ls);
}

// pickle
sink_val sink_pickle_json(sink_ctx ctx, sink_val a){
	return opi_pickle_json(ctx, a);
}

sink_val sink_pickle_bin(sink_ctx ctx, sink_val a){
	return opi_pickle_bin(ctx, a);
}

sink_val sink_pickle_val(sink_ctx ctx, sink_val a){
	return opi_pickle_val(ctx, a);
}

int sink_pickle_valid(sink_ctx ctx, sink_val a){
	return opi_pickle_valid(ctx, a);
}

bool sink_pickle_sibling(sink_ctx ctx, sink_val a){
	return opi_pickle_sibling(ctx, a);
}

bool sink_pickle_circular(sink_ctx ctx, sink_val a){
	return opi_pickle_circular(ctx, a);
}

sink_val sink_pickle_copy(sink_ctx ctx, sink_val a){
	return opi_pickle_copy(ctx, a);
}

sink_str sink_pickle_binstr(sink_ctx ctx, sink_val a){
	str_st s;
	opi_pickle_binstr(ctx, a, &s);
	return (sink_str){ .size = s.size, .bytes = s.bytes };
}

void sink_pickle_binstrfree(sink_str str){
	if (str.size >= 0 && str.bytes)
		mem_free((uint8_t *)str.bytes);
}

bool sink_pickle_valstr(sink_ctx ctx, sink_str str, sink_val *out){
	str_st s = { .size = str.size, .bytes = (uint8_t *)str.bytes };
	return opi_pickle_valstr(ctx, s, out);
}

// gc
void sink_gc_pin(sink_ctx ctx, sink_val v){
	context_gcpin((context)ctx, v);
}

void sink_gc_unpin(sink_ctx ctx, sink_val v){
	context_gcunpin((context)ctx, v);
}

sink_gc_level sink_gc_getlevel(sink_ctx ctx){
	return ((context)ctx)->gc_level;
}

void sink_gc_setlevel(sink_ctx ctx, sink_gc_level level){
	((context)ctx)->gc_level = level;
}

void sink_gc_run(sink_ctx ctx){
	context_gc((context)ctx);
}

sink_wait sink_abortstr(sink_ctx ctx, const char *fmt, ...){
	va_list args, args2;
	va_start(args, fmt);
	va_copy(args2, args);
	size_t s = vsnprintf(NULL, 0, fmt, args);
	char *buf = mem_alloc(s + 1);
	vsprintf_s(buf, s + 1, fmt, args2);
	va_end(args);
	va_end(args2);
	opi_abort(ctx, buf);
	return NULL;
}
