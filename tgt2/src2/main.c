// (c) Copyright 2016-2020, Sean Connelly (@velipso), sean.cm
// MIT License
// Project Home: https://github.com/velipso/sink

#include "sink.h"
#include <string.h>
#include <stdio.h>

#if defined(SINK_WIN)
# include <direct.h> // _getcwd
# define getcwd _getcwd
# include <io.h>     // _setmode, _fileno
# include <fcntl.h>  // _O_BINARY
# include <stdlib.h> // getenv_s
#else
# include <unistd.h> // getcwd
#endif

#if defined(SINK_WIN)
static inline FILE *fopen_i(const char *file, const char *mode){
  // remove annoying warnings about using "deprecated" (ugh) fopen
  FILE *fp;
  errno_t err = fopen_s(&fp, file, mode);
  if (err != 0){
    if (fp)
      fclose(fp);
    return NULL;
  }
  return fp;
}
#else
# define fopen_i(a, b) fopen(a, b)
#endif

#if defined(SINK_WIN)
static inline const char *getenv_i(const char *name){
  char *libvar;
  size_t requiredSize;
  getenv_s(&requiredSize, NULL, 0, name);
  if (requiredSize == 0)
    return NULL;
  libvar = malloc(requiredSize * sizeof(char));
  getenv_s(&requiredSize, libvar, requiredSize, name);
  return libvar;
}

static inline void freeenv_i(const char *ptr){
  free((char *)ptr);
}
#else
# define getenv_i(s) getenv(s)
# define freeenv_i(s)
#endif

static sink_wait io_say(sink_ctx ctx, sink_str str, void *iouser){
  printf("%.*s\n", str.size, str.bytes);
  return NULL;
}

static sink_wait io_warn(sink_ctx ctx, sink_str str, void *iouser){
  fprintf(stderr, "%.*s\n", str.size, str.bytes);
  return NULL;
}

static sink_wait io_ask(sink_ctx ctx, sink_str str, void *iouser){
  printf("%.*s", str.size, str.bytes);
  char buf[1000];
  if (fgets(buf, sizeof(buf), stdin) == NULL)
    return NULL;
  int sz = strlen(buf);
  if (sz <= 0)
    return sink_done(ctx, sink_str_newcstr(ctx, ""));
  if (buf[sz - 1] == '\n')
    buf[--sz] = 0; // TODO: do I need to check for \r as well..? test on windows
  return sink_done(ctx, sink_str_newblob(ctx, sz, (const uint8_t *)buf));
}

static sink_io_st io = (sink_io_st){
  .f_say = io_say,
  .f_warn = io_warn,
  .f_ask = io_ask,
  .user = NULL
};

static volatile bool done = false;

#if defined(SINK_POSIX) || defined(SINK_MAC)

#include <signal.h>

static void catchdone(int dummy){
  fclose(stdin);
  done = true;
}

static inline void catchint(){
  signal(SIGINT, catchdone);
  signal(SIGSTOP, catchdone);
}

#else

static inline void catchint(){
  // do nothing, I guess
}

#endif

#if defined(SINK_POSIX) || defined(SINK_MAC)
# include <dirent.h>
#else
# include <sys/types.h>
#endif

#include <sys/stat.h>

#if !defined(S_ISDIR)
# define S_ISDIR(st_mode) (st_mode & S_IFDIR)
#endif

static bool isdir(const char *dir){
  struct stat buf;
  if (stat(dir, &buf) != 0)
    return 0;
  return S_ISDIR(buf.st_mode);
}

static bool isfile(const char *file){
  FILE *fp = fopen_i(file, "rb");
  if (fp == NULL)
    return false;
  fclose(fp);
  return true;
}

static bool fsread(sink_scr scr, const char *file, void *user){
  FILE *fp = fopen_i(file, "rb");
  if (fp == NULL)
    return false; // `false` indicates that the file couldn't be read
  char buf[5000];
  while (!feof(fp)){
    size_t sz = fread(buf, 1, sizeof(buf), fp);
    if (!sink_scr_write(scr, sz, (const uint8_t *)buf))
      break;
  }
  fclose(fp);
  return true; // `true` indicates that the file was read
}

static sink_fstype fstype(sink_scr scr, const char *file, void *user){
  if (isdir(file))
    return SINK_FSTYPE_DIR;
  else if (isfile(file))
    return SINK_FSTYPE_FILE;
  return SINK_FSTYPE_NONE;
}

static sink_inc_st inc = {
  .f_fstype = fstype,
  .f_fsread = fsread,
  .user = NULL
};

static inline sink_ctx newctx(sink_scr scr, int argc, char **argv, const char *sink_exe,
  const char *script){
  // create the context with the standard I/O
  sink_ctx ctx = sink_ctx_new(scr, io);

  // add any libraries
  //sink_shell_ctx(ctx, argc, argv, sink_exe, script);

  return ctx;
}

static inline void printline(int line, int level){
  printf("%2d", line);
  if (level <= 0)
    printf(": ");
  else{
    printf(".");
    for (int i = 0; i < level; i++)
      printf("..");
    printf(" ");
  }
}

static inline void printscrerr(sink_scr scr){
  // scripts always have an error message when they fail
  fprintf(stderr, "%s\n", sink_scr_geterr(scr));
}

static inline void printctxerr(sink_ctx ctx){
  const char *err = sink_ctx_geterr(ctx);
  if (err == NULL) // context can error without an error message if script contains `abort`
    return;      // without any parameters
  fprintf(stderr, "%s\n", err);
}

typedef struct {
  sink_scr scr;
  int line;
  int size;
  int count;
  char *buf;
  int res;
} replinfo_st, *replinfo;

static void main_repl_nextline(sink_ctx ctx, sink_val statusv, replinfo ri){
  if (done)
    return;

  sink_run status = (sink_run)sink_castnum(statusv);
  switch (status){
    case SINK_RUN_PASS:
      done = true;
      ri->res = 0;
      return;
    case SINK_RUN_FAIL:
      printctxerr(ctx);
      break;
    case SINK_RUN_ASYNC:
      fprintf(stderr, "REPL returned async (impossible)\n");
      done = true;
      return;
    case SINK_RUN_TIMEOUT:
      fprintf(stderr, "REPL returned timeout (impossible)\n");
      done = true;
      return;
    case SINK_RUN_REPLMORE:
      // do nothing
      break;
  }

  printline(ri->line++, sink_scr_level(ri->scr));
  ri->size = 0;
  while (!done){
    int ch = getchar();
    if (ch == EOF){
      ch = '\n';
      done = true;
    }
    if (ri->size >= ri->count - 1){ // make sure there is always room for two chars
      ri->count += 200;
      ri->buf = realloc(ri->buf, sizeof(char) * ri->count);
      if (ri->buf == NULL){
        fprintf(stderr, "Out of memory!\n");
        ri->res = 1;
        done = true;
        return;
      }
    }
    ri->buf[ri->size++] = ch;
    if (ch == '\n'){
      if (!sink_scr_write(ri->scr, ri->size, (uint8_t *)ri->buf))
        printscrerr(ri->scr);
      if (sink_scr_level(ri->scr) <= 0){
        if (done){ // if done, run one last time
          sink_then(
            sink_ctx_run(ctx),
            (sink_then_st){
              .f_then = (sink_then_f)main_repl_nextline,
              .f_cancel = NULL,
              .user = ri
            }
          );
        }
        // the level is <= 0, so we need to run the context... this is done by returning
        // from this function, which will eventually return up to `main_repl`, where the
        // while-loop will execute `sink_ctx_run`
        return;
      }
      else{
        if (done)
          return;
        printline(ri->line++, sink_scr_level(ri->scr));
        ri->size = 0;
      }
    }
  }
}

static int main_repl(sink_scr scr, int argc, char **argv, const char *sink_exe){
  catchint();
  sink_ctx ctx = newctx(scr, argc, argv, sink_exe, NULL);

  replinfo_st ri = (replinfo_st){
    .scr = scr,
    .line = 1,
    .size = 0,
    .count = 0,
    .buf = NULL,
    .res = 0
  };

  while (!done){
    sink_then(
      sink_ctx_run(ctx),
      (sink_then_st){
        .f_then = (sink_then_f)main_repl_nextline,
        .f_cancel = NULL,
        .user = &ri
      }
    );
  }

  free(ri.buf);
  sink_ctx_free(ctx);
  sink_scr_free(scr);
  return ri.res;
}

static void run_setresult(sink_ctx ctx, sink_val result, sink_run *output){
  *output = result.f;
}

static int main_run(sink_scr scr, const char *file, int argc, char **argv, const char *sink_exe){
  if (!sink_scr_loadfile(scr, file)){
    printscrerr(scr);
    sink_scr_free(scr);
    return 1;
  }
  sink_ctx ctx = newctx(scr, argc, argv, sink_exe, sink_scr_getfile(scr));
  sink_run res = SINK_RUN_FAIL;
  sink_then(
    sink_ctx_run(ctx),
    (sink_then_st){
      .f_then = (sink_then_f)run_setresult,
      .f_cancel = NULL,
      .user = &res
    }
  );
  if (res == SINK_RUN_FAIL)
    printctxerr(ctx);
  sink_ctx_free(ctx);
  sink_scr_free(scr);
  return res == SINK_RUN_PASS ? 0 : 1;
}

static int main_eval(sink_scr scr, const char *eval, int argc, char **argv, const char *sink_exe){
  if (!sink_scr_write(scr, strlen(eval), (const uint8_t *)eval)){
    printscrerr(scr);
    sink_scr_free(scr);
    return 1;
  }
  sink_ctx ctx = newctx(scr, argc, argv, sink_exe, NULL);
  sink_run res = SINK_RUN_FAIL;
  sink_then(
    sink_ctx_run(ctx),
    (sink_then_st){
      .f_then = (sink_then_f)run_setresult,
      .f_cancel = NULL,
      .user = &res
    }
  );
  if (res == SINK_RUN_FAIL)
    printctxerr(ctx);
  sink_ctx_free(ctx);
  sink_scr_free(scr);
  return res == SINK_RUN_PASS ? 0 : 1;
}

static int main_compile_file(sink_scr scr, const char *file, bool debug){
  if (!sink_scr_loadfile(scr, file)){
    printscrerr(scr);
    sink_scr_free(scr);
    return 1;
  }
#if defined(SINK_WIN)
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  sink_scr_dump(scr, debug, (void *)stdout, (sink_dump_f)fwrite);
  sink_scr_free(scr);
  return 0;
}

static int main_compile_eval(sink_scr scr, const char *eval, bool debug){
  if (!sink_scr_write(scr, strlen(eval), (const uint8_t *)eval)){
    printscrerr(scr);
    sink_scr_free(scr);
    return 1;
  }
#if defined(SINK_WIN)
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  sink_scr_dump(scr, debug, (void *)stdout, (sink_dump_f)fwrite);
  sink_scr_free(scr);
  return 0;
}

static void print_version(){
  printf(
    "Sink v1.0\n"
    "Copyright (c) 2016-2020 Sean Connelly (@velipso), MIT License\n"
    "https://github.com/velipso/sink  https://sean.cm\n");
}

static void print_help(){
  print_version();
  printf(
    "\nUsage:\n"
    "  sink [options] [ -e '<code>' | <file> ] [arguments]\n"
    "\n"
    "With no arguments, sink will enter interactive mode (REPL).\n"
    "\n"
    "Option           Description\n"
    "  -v               Display version information and exit\n"
    "  -h, --help       Display help information and exit\n"
    "  -I <path>        Add <path> to the include search path\n"
    "  -c               Compile input and output bytecode to stdout\n"
    "  -d               If compiling, output bytecode with debug info\n"
    "  -D <key> <file>  If compiling, add <file> declarations when including <key>\n"
    "\n"
    "  The -D option is useful for providing declarations so that compilation can\n"
    "  succeed for other host environments.\n"
    "\n"
    "  For example, a host might provide declarations for native commands via:\n"
    "\n"
    "    include 'shapes'\n"
    "\n"
    "  The host could provide a declaration file, which can be used during\n"
    "  compilation using a `-D shapes shapes_decl.sink` option.  This means when the\n"
    "  script executes `include 'shapes'`, the compiler will load `shapes_decl.sink`.\n"
    "  Even though the compiler doesn't know how to execute the host commands, it can\n"
    "  still compile the file for use in the host environment.\n");
}

int main(int argc, char **argv){
  bool compile = false;
  bool compile_debug = false;
  enum {
    INPUT_REPL,
    INPUT_FILE,
    INPUT_EVAL
  } input_type = INPUT_REPL;
  char *input_content = NULL;

  // first pass, just figure out what we're doing and validate arguments
  int i;
  for (i = 1; i < argc; i++){
    if (strcmp(argv[i], "-v") == 0){
      if (i + 1 < argc){
        print_help();
        return 1;
      }
      print_version();
      return 0;
    }
    else if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0){
      print_help();
      return i + 1 < argc ? 1 : 0;
    }
    else if (strcmp(argv[i], "-I") == 0){
      if (i + 1 >= argc){
        print_help();
        return 1;
      }
      i++; // skip include path
    }
    else if (strcmp(argv[i], "-c") == 0)
      compile = true;
    else if (strcmp(argv[i], "-d") == 0)
      compile_debug = true;
    else if (strcmp(argv[i], "-D") == 0){
      if (i + 2 >= argc){
        print_help();
        return 1;
      }
      i += 2; // skip declaration key/file
    }
    else if (strcmp(argv[i], "-e") == 0){
      if (i + 1 >= argc){
        print_help();
        return 1;
      }
      input_content = argv[i + 1];
      i += 2; // skip over script
      input_type = INPUT_EVAL;
      break;
    }
    else if (strcmp(argv[i], "--") == 0){
      i++;
      break;
    }
    else{
      if (argv[i][0] == '-'){
        // some unknown option
        print_help();
        return 1;
      }
      input_content = argv[i];
      i++; // skip over file
      input_type = INPUT_FILE;
      break;
    }
  }

  if (compile && input_type == INPUT_REPL){
    print_help();
    return 1;
  }

  // grab sink arguments
  int s_argc = argc - i;
  char **s_argv = &argv[i];

  // create the script with the current working directory
  char *cwd = getcwd(NULL, 0);
#if defined(SINK_WIN)
  bool posix = false;
#else
  bool posix = true;
#endif
  sink_scr scr = sink_scr_new(inc, cwd, posix, input_type == INPUT_REPL);
  free(cwd);

  // add the appropriate paths
  const char *sp = getenv_i("SINK_PATH");
  if (sp == NULL){
    // if no environment variable, then add a default path of the current directory
    sink_scr_addpath(scr, ".");
  }
  else{
    fprintf(stderr, "TODO: process SINK_PATH\n");
    abort();
    freeenv_i(sp);
  }

  // add any libraries
  //sink_shell_scr(scr);

  // load include paths and declaration key/files
  for (i = 1; argv[i] != input_content; i++){
    if (strcmp(argv[i], "-I") == 0){
      sink_scr_addpath(scr, argv[i + 1]);
      i++;
    }
    else if (strcmp(argv[i], "-D") == 0){
      sink_scr_incfile(scr, argv[i + 1], argv[i + 2]);
      i += 2;
    }
  }

  const char *sink_exe = argv[0];

  switch (input_type){
    case INPUT_FILE:
      if (compile)
        return main_compile_file(scr, input_content, compile_debug);
      return main_run(scr, input_content, s_argc, s_argv, sink_exe);

    case INPUT_REPL:
      return main_repl(scr, s_argc, s_argv, sink_exe);

    case INPUT_EVAL:
      if (compile)
        return main_compile_eval(scr, input_content, compile_debug);
      return main_eval(scr, input_content, s_argc, s_argv, sink_exe);
  }
  // shouldn't happen
  return 1;
}
