import { CONTACT_KINDS, FORMAT, fromJsonResume, isJsonResume, migrate, validate, type Profile, type Project } from "@foja/core";
import exampleEs from "../../../../examples/example.project.json";
import exampleEn from "../../../../examples/example.en.project.json";
import pasantiaEs from "../../../../examples/pasantia.project.json";
import pasantiaEn from "../../../../examples/pasantia.en.project.json";
import cosmetologaEs from "../../../../examples/cosmetologa.project.json";
import cosmetologaEn from "../../../../examples/cosmetologa.en.project.json";
import primerEmpleoEs from "../../../../examples/primer-empleo.project.json";
import primerEmpleoEn from "../../../../examples/primer-empleo.en.project.json";
import { t, useLanguage } from "./i18n";
import { newId } from "./forms/Skills";

/** The examples with made-up people, for a CV with little in it: each has a profile in an
 * eye-catching style first and one for job portals second. */
const EXAMPLES = {
  pasantia: [pasantiaEs, pasantiaEn],
  cosmetologa: [cosmetologaEs, cosmetologaEn],
  primerEmpleo: [primerEmpleoEs, primerEmpleoEn],
} satisfies Record<string, [unknown, unknown]>;
export type ExampleId = keyof typeof EXAMPLES;
export const EXAMPLE_IDS = Object.keys(EXAMPLES) as ExampleId[];

/** An example in the interface's language: my own CV with its three profiles, or `id`'s. */
export const exampleProject = (id?: ExampleId): Project => {
  const [es, en]: [unknown, unknown] = id ? EXAMPLES[id] : [exampleEs, exampleEn];
  return structuredClone(useLanguage.getState().lang === "es" ? es : en) as Project;
};

export function emptyProject(): Project {
  return {
    format: FORMAT,
    language: useLanguage.getState().lang,
    person: { givenNames: [t.defaults.givenName], familyNames: [t.defaults.familyName], photo: null },
    contacts: { email: t.defaults.email },
    skills: {},
    entries: {},
    profiles: {
      cv: {
        name: "CV",
        subtitle: t.defaults.subtitle,
        contacts: ["email"],
        skills: [],
        summary: "",
        sections: [{ id: "experiencia", title: t.defaults.experience, blocks: [] }],
      },
    },
  };
}

export function newProfile(project: Project): [string, Profile] {
  return [
    newId("perfil", project.profiles),
    {
      name: t.newProfile,
      subtitle: t.defaults.subtitle,
      contacts: CONTACT_KINDS.filter((k) => project.contacts[k]),
      skills: [],
      summary: "",
      sections: [],
    },
  ];
}

/** Parses an imported file, a Foja project or a JSON Resume; throws with the problems when it is neither. */
export function parseProject(text: string): Project {
  const parsed = JSON.parse(text);
  if (isJsonResume(parsed)) return fromJsonResume(parsed, { name: "CV", language: useLanguage.getState().lang }).project;
  const value = migrate(parsed);
  const problems = validate(value).filter((p) => p.severity === "error");
  if (problems.length) throw new Error(problems.slice(0, 5).map((p) => `${p.path}: ${p.message}`).join("\n"));
  return value as Project;
}
