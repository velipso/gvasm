//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

#ifndef SINK__H
#define SINK__H

#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include <stdarg.h>
#include <stdlib.h>

// platform detection
#if !defined(SINK_WIN) && !defined(SINK_MAC) && !defined(SINK_POSIX)
#	if defined(_WIN32)
#		define SINK_WIN
#	elif __APPLE__
#		define SINK_MAC
#	elif __linux__ || __unix__ || defined(_POSIX_VERSION) || defined(__CYGWIN__)
#		define SINK_POSIX
#	else
#		error "Unknown compiler"
#	endif
#endif

typedef void *(*sink_malloc_f)(size_t sz);
typedef void *(*sink_realloc_f)(void *ptr, size_t sz);
typedef void (*sink_free_f)(void *ptr);

// all memory management is through these functions, which default to stdlib's malloc/realloc/free
// overwrite these global variables with your own functions if desired
extern sink_malloc_f  sink_malloc;
extern sink_realloc_f sink_realloc;
extern sink_free_f    sink_free;

// the source of randomness when performing `rand.seedauto`
typedef uint32_t (*sink_seedauto_src_f)();
extern sink_seedauto_src_f sink_seedauto_src;

// the number of ticks a garbage collection consumes
#ifndef SINK_GC_TICKS
#	define SINK_GC_TICKS 100
#endif

typedef enum {
	SINK_TYPE_NIL,
	SINK_TYPE_NUM,
	SINK_TYPE_STR,
	SINK_TYPE_LIST
} sink_type;

typedef union {
	uint64_t u;
	double f;
} sink_val;

typedef int sink_user;

typedef struct {
	sink_val *vals;
	int size;
} sink_list;

typedef struct {
	// `bytes` can be NULL for a size 0 string
	// otherwise, `bytes[size]` is guaranteed to be 0
	uint8_t *bytes;
	int size;
} sink_str;

typedef void *sink_wait;
typedef void *sink_scr;
typedef void *sink_ctx;

typedef enum {
	SINK_FSTYPE_NONE,
	SINK_FSTYPE_FILE,
	SINK_FSTYPE_DIR
} sink_fstype;

typedef enum {
	SINK_GC_NONE,
	SINK_GC_DEFAULT,
	SINK_GC_LOWMEM
} sink_gc_level;

typedef enum {
	SINK_RUN_PASS,
	SINK_RUN_FAIL,
	SINK_RUN_ASYNC,
	SINK_RUN_TIMEOUT,
	SINK_RUN_REPLMORE
} sink_run;

typedef enum {
	SINK_READY,
	SINK_WAITING, // waiting for an async result
	SINK_PASSED,
	SINK_FAILED
} sink_status;

typedef sink_fstype (*sink_fstype_f)(sink_scr scr, const char *file, void *incuser);
typedef bool (*sink_fsread_f)(sink_scr scr, const char *file, void *incuser);
typedef sink_wait (*sink_io_f)(sink_ctx ctx, sink_str str, void *iouser);
typedef sink_wait (*sink_native_f)(sink_ctx ctx, int size, const sink_val *args, void *natuser);
typedef size_t (*sink_dump_f)(const void *restrict ptr, size_t size, size_t nitems,
	void *restrict dumpuser);
typedef void (*sink_then_f)(sink_ctx ctx, sink_val result, void *thenuser);
typedef void (*sink_cancel_f)(void *thenuser);

typedef struct {
	sink_io_f f_say;
	sink_io_f f_warn;
	sink_io_f f_ask;
	void *user; // passed as iouser to functions
} sink_io_st;

typedef struct {
	sink_fstype_f f_fstype;
	sink_fsread_f f_fsread;
	void *user; // passed as incuser to functions
} sink_inc_st;

typedef struct {
	sink_then_f f_then;
	sink_cancel_f f_cancel;
	void *user; // passed as thenuser to functions
} sink_then_st;

// Values are jammed into sNaNs, like so:
//
// NaN (64 bit):
//  01111111 1111Q000 00000000 TTTTTTTT  0FFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF
//
// NAN    :  Q = 1, T = 0, F = 0
// NIL    :  Q = 0, T = 1, F = 0
// STR    :  Q = 0, T = 2, F = table index (31 bits)
// LIST   :  Q = 0, T = 3, F = table index (31 bits)

static const sink_val SINK_NAN         = { .u = UINT64_C(0x7FF8000000000000) };
static const sink_val SINK_NIL         = { .u = UINT64_C(0x7FF0000100000000) };
static const uint64_t SINK_TAG_STR     =        UINT64_C(0x7FF0000200000000)  ;
static const uint64_t SINK_TAG_LIST    =        UINT64_C(0x7FF0000300000000)  ;
static const uint64_t SINK_TAG_MASK    =        UINT64_C(0xFFFFFFFF80000000)  ;
static const uint64_t SINK_INDEX_MASK  =        UINT64_C(0x000000007FFFFFFF)  ;
static const uint64_t SINK_NAN_MASK    =        UINT64_C(0x7FF8000000000000)  ;

sink_scr    sink_scr_new(sink_inc_st inc, const char *curdir, bool posix, bool repl);
void        sink_scr_addpath(sink_scr scr, const char *path);
void        sink_scr_incbody(sink_scr scr, const char *name, const char *body);
void        sink_scr_incfile(sink_scr scr, const char *name, const char *file);
const char *sink_scr_getfile(sink_scr scr);
const char *sink_scr_getcwd(sink_scr scr);
const char *sink_scr_geterr(sink_scr scr);
void        sink_scr_cleanup(sink_scr scr, void *cuser, sink_free_f f_free);
void        sink_scr_setuser(sink_scr scr, void *user, sink_free_f f_free);
void *      sink_scr_getuser(sink_scr scr);
bool        sink_scr_loadfile(sink_scr scr, const char *file);
bool        sink_scr_write(sink_scr scr, int size, const uint8_t *bytes);
int         sink_scr_level(sink_scr scr);
void        sink_scr_dump(sink_scr scr, bool debug, void *user, sink_dump_f f_dump);
void        sink_scr_free(sink_scr scr);

// context
sink_ctx    sink_ctx_new(sink_scr scr, sink_io_st io);
sink_status sink_ctx_getstatus(sink_ctx ctx);
const char *sink_ctx_geterr(sink_ctx ctx);
void        sink_ctx_native(sink_ctx ctx, const char *name, void *natuser, sink_native_f f_native);
void        sink_ctx_nativehash(sink_ctx ctx, uint64_t hash, void *natuser, sink_native_f f_native);
void        sink_ctx_cleanup(sink_ctx ctx, void *cuser, sink_free_f f_free);
void        sink_ctx_setuser(sink_ctx ctx, void *user, sink_free_f f_free);
void *      sink_ctx_getuser(sink_ctx ctx);
sink_user   sink_ctx_addusertype(sink_ctx ctx, const char *hint, sink_free_f f_free);
sink_free_f sink_ctx_getuserfree(sink_ctx ctx, sink_user usertype);
const char *sink_ctx_getuserhint(sink_ctx ctx, sink_user usertype);
void        sink_ctx_settimeout(sink_ctx ctx, int timeout);
int         sink_ctx_gettimeout(sink_ctx ctx);
void        sink_ctx_consumeticks(sink_ctx ctx, int amount);
void        sink_ctx_forcetimeout(sink_ctx ctx);
sink_wait   sink_ctx_run(sink_ctx ctx);
void        sink_ctx_free(sink_ctx ctx);

// wait
sink_wait sink_waiter(sink_ctx ctx);                 // create wait object
sink_wait sink_done(sink_ctx ctx, sink_val result);  // create wait object that already has a result
void      sink_then(sink_wait w, sink_then_st then); // attach the handler
void      sink_result(sink_wait w, sink_val result); // provide the result

// value
static inline sink_val sink_bool(bool f){ return f ? (sink_val){ .f = 1 } : SINK_NIL; }
static inline bool sink_istrue(sink_val v){ return v.u != SINK_NIL.u; }
static inline bool sink_isfalse(sink_val v){ return v.u == SINK_NIL.u; }
static inline bool sink_isnil(sink_val v){ return v.u == SINK_NIL.u; }
static inline bool sink_isstr(sink_val v){ return (v.u & SINK_TAG_MASK) == SINK_TAG_STR; }
static inline bool sink_islist(sink_val v){ return (v.u & SINK_TAG_MASK) == SINK_TAG_LIST; }
static inline bool sink_isnum(sink_val v){
	return !sink_isnil(v) && !sink_isstr(v) && !sink_islist(v); }
static inline sink_type sink_typeof(sink_val v){
	if      (sink_isnil    (v)) return SINK_TYPE_NIL;
	else if (sink_isstr    (v)) return SINK_TYPE_STR;
	else if (sink_islist   (v)) return SINK_TYPE_LIST;
	else                        return SINK_TYPE_NUM;
}
static inline double sink_castnum(sink_val v){ return v.f; }
sink_str  sink_caststr(sink_ctx ctx, sink_val str);
sink_list sink_castlist(sink_ctx ctx, sink_val ls);

// argument helpers
bool sink_arg_bool(int size, const sink_val *args, int index);
bool sink_arg_num(sink_ctx ctx, int size, const sink_val *args, int index, double *num);
bool sink_arg_str(sink_ctx ctx, int size, const sink_val *args, int index, sink_str *str);
bool sink_arg_list(sink_ctx ctx, int size, const sink_val *args, int index, sink_list *ls);
bool sink_arg_user(sink_ctx ctx, int size, const sink_val *args, int index, sink_user usertype,
	void **user);

// globals
sink_val  sink_tonum(sink_ctx ctx, sink_val v);
sink_val  sink_tostr(sink_ctx ctx, sink_val v);
int       sink_size(sink_ctx ctx, sink_val v);
sink_wait sink_say(sink_ctx ctx, int size, sink_val *vals);
sink_wait sink_warn(sink_ctx ctx, int size, sink_val *vals);
sink_wait sink_ask(sink_ctx ctx, int size, sink_val *vals);
void      sink_exit(sink_ctx ctx);
void      sink_abort(sink_ctx ctx, int size, sink_val *vals);
sink_wait sink_abortstr(sink_ctx ctx, const char *fmt, ...); // always returns NULL
bool      sink_isnative(sink_ctx ctx, const char *name);
bool      sink_isnativehash(sink_ctx ctx, uint64_t hash);
sink_val  sink_range(sink_ctx ctx, double start, double stop, double step);
int       sink_order(sink_ctx ctx, sink_val a, sink_val b);
sink_val  sink_stacktrace(sink_ctx ctx);

// numbers
static inline sink_val sink_num(double v){ return (sink_val){ .f = v }; }
sink_val sink_num_neg(sink_ctx ctx, sink_val a);
sink_val sink_num_add(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_sub(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_mul(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_div(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_mod(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_pow(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_abs(sink_ctx ctx, sink_val a);
sink_val sink_num_sign(sink_ctx ctx, sink_val a);
sink_val sink_num_max(sink_ctx ctx, int size, sink_val *vals);
sink_val sink_num_min(sink_ctx ctx, int size, sink_val *vals);
sink_val sink_num_clamp(sink_ctx ctx, sink_val a, sink_val b, sink_val c);
sink_val sink_num_floor(sink_ctx ctx, sink_val a);
sink_val sink_num_ceil(sink_ctx ctx, sink_val a);
sink_val sink_num_round(sink_ctx ctx, sink_val a);
sink_val sink_num_trunc(sink_ctx ctx, sink_val a);
static inline sink_val sink_num_nan(){ return SINK_NAN; }
static inline sink_val sink_num_inf(){ return sink_num(INFINITY); }
static inline bool     sink_num_isnan(sink_val v){ return (v.u & SINK_NAN_MASK) == SINK_NAN_MASK; }
static inline bool     sink_num_isfinite(sink_val v){ return isfinite(v.f); }
static inline sink_val sink_num_e(){ return sink_num(2.71828182845904523536028747135266250); }
static inline sink_val sink_num_pi(){ return sink_num(3.14159265358979323846264338327950288); }
static inline sink_val sink_num_tau(){ return sink_num(6.28318530717958647692528676655900576); }
sink_val sink_num_sin(sink_ctx ctx, sink_val a);
sink_val sink_num_cos(sink_ctx ctx, sink_val a);
sink_val sink_num_tan(sink_ctx ctx, sink_val a);
sink_val sink_num_asin(sink_ctx ctx, sink_val a);
sink_val sink_num_acos(sink_ctx ctx, sink_val a);
sink_val sink_num_atan(sink_ctx ctx, sink_val a);
sink_val sink_num_atan2(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_log(sink_ctx ctx, sink_val a);
sink_val sink_num_log2(sink_ctx ctx, sink_val a);
sink_val sink_num_log10(sink_ctx ctx, sink_val a);
sink_val sink_num_exp(sink_ctx ctx, sink_val a);
sink_val sink_num_lerp(sink_ctx ctx, sink_val a, sink_val b, sink_val t);
sink_val sink_num_hex(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_oct(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_num_bin(sink_ctx ctx, sink_val a, sink_val b);

// integers
sink_val sink_int_new(sink_ctx ctx, sink_val a);
sink_val sink_int_not(sink_ctx ctx, sink_val a);
sink_val sink_int_and(sink_ctx ctx, int size, sink_val *vals);
sink_val sink_int_or (sink_ctx ctx, int size, sink_val *vals);
sink_val sink_int_xor(sink_ctx ctx, int size, sink_val *vals);
sink_val sink_int_shl(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_int_shr(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_int_sar(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_int_add(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_int_sub(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_int_mul(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_int_div(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_int_mod(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_int_clz(sink_ctx ctx, sink_val a);
sink_val sink_int_pop(sink_ctx ctx, sink_val a);
sink_val sink_int_bswap(sink_ctx ctx, sink_val a);

// random
void     sink_rand_seed(sink_ctx ctx, uint32_t a);
void     sink_rand_seedauto(sink_ctx ctx);
uint32_t sink_rand_int(sink_ctx ctx);
double   sink_rand_num(sink_ctx ctx);
sink_val sink_rand_range(sink_ctx ctx, double start, double stop, double step);
sink_val sink_rand_getstate(sink_ctx ctx);
void     sink_rand_setstate(sink_ctx ctx, sink_val a);
sink_val sink_rand_pick(sink_ctx ctx, sink_val ls);
void     sink_rand_shuffle(sink_ctx ctx, sink_val ls);

// strings
sink_val sink_str_newcstr(sink_ctx ctx, const char *str);
sink_val sink_str_newcstrgive(sink_ctx ctx, char *str);
sink_val sink_str_newblob(sink_ctx ctx, int size, const uint8_t *bytes);
sink_val sink_str_newblobgive(sink_ctx ctx, int size, uint8_t *bytes);
static inline sink_val sink_str_newempty(sink_ctx ctx){ return sink_str_newblobgive(ctx, 0, NULL); }
sink_val sink_str_newformat(sink_ctx ctx, const char *fmt, ...);
sink_val sink_str_new(sink_ctx ctx, int size, sink_val *vals);
sink_val sink_str_cat(sink_ctx ctx, int size, sink_val *vals);
sink_val sink_str_slice(sink_ctx ctx, sink_val a, sink_val start, sink_val len);
sink_val sink_str_splice(sink_ctx ctx, sink_val a, sink_val start, sink_val len, sink_val b);
sink_val sink_str_split(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_str_replace(sink_ctx ctx, sink_val a, sink_val b, sink_val c);
bool     sink_str_begins(sink_ctx ctx, sink_val a, sink_val b);
bool     sink_str_ends(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_str_pad(sink_ctx ctx, sink_val a, int b);
sink_val sink_str_find(sink_ctx ctx, sink_val a, sink_val b, sink_val c);
sink_val sink_str_rfind(sink_ctx ctx, sink_val a, sink_val b, sink_val c);
sink_val sink_str_lower(sink_ctx ctx, sink_val a);
sink_val sink_str_upper(sink_ctx ctx, sink_val a);
sink_val sink_str_trim(sink_ctx ctx, sink_val a);
sink_val sink_str_rev(sink_ctx ctx, sink_val a);
sink_val sink_str_rep(sink_ctx ctx, sink_val a, int rep);
sink_val sink_str_list(sink_ctx ctx, sink_val a);
sink_val sink_str_byte(sink_ctx ctx, sink_val a, int b);
sink_val sink_str_hash(sink_ctx ctx, sink_val a, uint32_t seed);
void     sink_str_hashplain(int size, const uint8_t *bytes, uint32_t seed, uint32_t *out);

// utf8
bool     sink_utf8_valid(sink_ctx ctx, sink_val a);
sink_val sink_utf8_list(sink_ctx ctx, sink_val a);
sink_val sink_utf8_str(sink_ctx ctx, sink_val a);

// structs
sink_val sink_struct_size(sink_ctx ctx, sink_val tpl);
sink_val sink_struct_str(sink_ctx ctx, sink_val ls, sink_val tpl);
sink_val sink_struct_list(sink_ctx ctx, sink_val a, sink_val tpl);
bool     sink_struct_isLE();

// lists
void     sink_list_setuser(sink_ctx ctx, sink_val ls, sink_user usertype, void *user);
bool     sink_list_hasuser(sink_ctx ctx, sink_val ls, sink_user usertype);
void *   sink_list_getuser(sink_ctx ctx, sink_val ls);
sink_val sink_list_newblob(sink_ctx ctx, int size, const sink_val *vals);
sink_val sink_list_newblobgive(sink_ctx ctx, int size, int count, sink_val *vals);
static inline sink_val sink_list_newempty(sink_ctx ctx){ return sink_list_newblob(ctx, 0, NULL); }
sink_val sink_list_new(sink_ctx ctx, sink_val a, sink_val b);
sink_val sink_list_cat(sink_ctx ctx, int size, sink_val *vals);
sink_val sink_list_slice(sink_ctx ctx, sink_val ls, sink_val start, sink_val len);
void     sink_list_splice(sink_ctx ctx, sink_val ls, sink_val start, sink_val len, sink_val ls2);
sink_val sink_list_shift(sink_ctx ctx, sink_val ls);
sink_val sink_list_pop(sink_ctx ctx, sink_val ls);
void     sink_list_push(sink_ctx ctx, sink_val ls, sink_val a);
void     sink_list_unshift(sink_ctx ctx, sink_val ls, sink_val a);
void     sink_list_append(sink_ctx ctx, sink_val ls, sink_val ls2);
void     sink_list_prepend(sink_ctx ctx, sink_val ls, sink_val ls2);
sink_val sink_list_find(sink_ctx ctx, sink_val ls, sink_val a, sink_val b);
sink_val sink_list_rfind(sink_ctx ctx, sink_val ls, sink_val a, sink_val b);
sink_val sink_list_join(sink_ctx ctx, sink_val ls, sink_val a);
sink_val sink_list_joinplain(sink_ctx ctx, int size, const sink_val *vals, int sepz,
	const uint8_t *sep);
void     sink_list_rev(sink_ctx ctx, sink_val ls);
sink_val sink_list_str(sink_ctx ctx, sink_val ls);
void     sink_list_sort(sink_ctx ctx, sink_val ls);
void     sink_list_rsort(sink_ctx ctx, sink_val ls);

// pickle
sink_val sink_pickle_json(sink_ctx ctx, sink_val a);
sink_val sink_pickle_bin(sink_ctx ctx, sink_val a);
sink_val sink_pickle_val(sink_ctx ctx, sink_val a);
int      sink_pickle_valid(sink_ctx ctx, sink_val a); // 0 for invalid, 1 for JSON, 2 for binary
bool     sink_pickle_sibling(sink_ctx ctx, sink_val a);
bool     sink_pickle_circular(sink_ctx ctx, sink_val a);
sink_val sink_pickle_copy(sink_ctx ctx, sink_val a);
sink_str sink_pickle_binstr(sink_ctx ctx, sink_val a);
void     sink_pickle_binstrfree(sink_str str);
bool     sink_pickle_valstr(sink_ctx ctx, sink_str str, sink_val *out);

// gc
void          sink_gc_pin(sink_ctx ctx, sink_val v);   // prevent a value from being GC'ed
void          sink_gc_unpin(sink_ctx ctx, sink_val v); // remove a previous pin
sink_gc_level sink_gc_getlevel(sink_ctx ctx);
void          sink_gc_setlevel(sink_ctx ctx, sink_gc_level level);
void          sink_gc_run(sink_ctx ctx);

// user helpers
static inline sink_val sink_user_new(sink_ctx ctx, sink_user usertype, void *user){
	sink_val hint = sink_str_newcstr(ctx, sink_ctx_getuserhint(ctx, usertype));
	sink_val ls = sink_list_newblob(ctx, 1, &hint);
	sink_list_setuser(ctx, ls, usertype, user);
	return ls;
}

#endif // SINK__H
