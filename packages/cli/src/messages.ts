// What `foja` prints, in English and Spanish. The language comes from `--lang`, or else from the system's locale:
// Spanish when any of its languages is Spanish, English otherwise.

const en = {
  usage: `usage:
  foja build <project.json> [--profile <id>]... [--format <format>]... [--out <dir>]
      formats: pdf (default), svg, typ, tex, md, json, docx, all (every one in a .zip);
      every profile unless --profile is given
  foja validate <project.json>
  foja convert-curriculum <cvgen/data> <out.json> [--public]

options:
  --lang <es|en>   the language of these messages (by default, the system's)
  -h, --help       this help`,
  invalidProject: "not a valid Foja project",
  unknownFormat: (format: string) => `unknown format "${format}"`,
  noProfile: (id: string) => `no profile "${id}"`,
  pages: (n: number) => ` (${n} page${n === 1 ? "" : "s"})`,
  valid: (n: number) => `valid, ${n} profile${n === 1 ? "" : "s"}`,
  profiles: (n: number) => `${n} profile${n === 1 ? "" : "s"}`,
  badLanguage: (lang: string) => `unknown language "${lang}" (es or en)`,
};

export type Messages = typeof en;

const es: Messages = {
  usage: `uso:
  foja build <proyecto.json> [--profile <id>]... [--format <formato>]... [--out <carpeta>]
      formatos: pdf (el predeterminado), svg, typ, tex, md, json, docx, all (todos en un .zip);
      todos los perfiles, salvo que se indique --profile
  foja validate <proyecto.json>
  foja convert-curriculum <cvgen/data> <salida.json> [--public]

opciones:
  --lang <es|en>   el idioma de estos mensajes (por defecto, el del sistema)
  -h, --help       esta ayuda`,
  invalidProject: "no es un proyecto de Foja válido",
  unknownFormat: (format: string) => `formato desconocido: "${format}"`,
  noProfile: (id: string) => `no hay un perfil "${id}"`,
  pages: (n: number) => ` (${n} ${n === 1 ? "página" : "páginas"})`,
  valid: (n: number) => `válido, ${n} ${n === 1 ? "perfil" : "perfiles"}`,
  profiles: (n: number) => `${n} ${n === 1 ? "perfil" : "perfiles"}`,
  badLanguage: (lang: string) => `idioma desconocido: "${lang}" (es o en)`,
};

export const MESSAGES = { en, es };
export type Language = keyof typeof MESSAGES;

/**
 * The system's preferred languages: GNU's LANGUAGE list and the locale that applies to messages (LC_ALL, else
 * LC_MESSAGES, else LANG). Without a locale, or with C or POSIX, the one Node reports: on Windows and macOS the
 * environment often sets none.
 */
export function systemLanguages(env: NodeJS.ProcessEnv = process.env): string[] {
  const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || "";
  if (!locale || /^(C|POSIX)([._@]|$)/.test(locale)) return [Intl.DateTimeFormat().resolvedOptions().locale];
  return [...(env.LANGUAGE ?? "").split(":").filter(Boolean), locale];
}

/** Spanish when any preferred language is Spanish (es, es_AR.UTF-8, es-419…), English otherwise. */
export function detectLanguage(preferred: string[]): Language {
  return preferred.some((l) => /^es([-_.@]|$)/i.test(l)) ? "es" : "en";
}

/** Takes `--lang <es|en>` (or `--lang=…`) out of the arguments; the rest go to the command. */
export function takeLanguage(argv: string[]): { lang?: string; rest: string[] } {
  const rest: string[] = [];
  let lang: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--lang") lang = argv[++i] ?? "";
    else if (argv[i].startsWith("--lang=")) lang = argv[i].slice("--lang=".length);
    else rest.push(argv[i]);
  }
  return { lang, rest };
}
