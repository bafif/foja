import { CONTACT_KINDS, FORMAT, migrate, validate, type Profile, type Project } from "@foja/core";
import exampleEs from "../../../../examples/example.project.json";
import exampleEn from "../../../../examples/example.en.project.json";
import { t, useLanguage } from "./i18n";
import { newId } from "./forms/Skills";

/** The example, my own CV with its three profiles, in the interface's language. */
export const exampleProject = (): Project => structuredClone(useLanguage.getState().lang === "es" ? exampleEs : exampleEn) as Project;

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

/** Parses an imported file; throws with the problems when it is not a Foja project. */
export function parseProject(text: string): Project {
  const value = migrate(JSON.parse(text));
  const problems = validate(value).filter((p) => p.severity === "error");
  if (problems.length) throw new Error(problems.slice(0, 5).map((p) => `${p.path}: ${p.message}`).join("\n"));
  return value as Project;
}
