/**
 * BLOOM Runtime — Canonical Identity Constants
 * Single source of truth for runtime branding across all UI surfaces.
 */

export const BLOOM_RUNTIME_IDENTITY = {
  name: "BLOOM Runtime",

  expansion: {
    en: "Bespoke Logic Orchestration & Operational Machines",
    uk: "Спеціалізовані системи логічної оркестрації та операційні машини",
    fr: "Orchestration Logique Sur Mesure & Machines Opérationnelles",
    de: "Maßgeschneiderte Logik-Orchestrierung & Operative Maschinen",
    it: "Orchestrazione Logica Su Misura & Macchine Operative",
  },

  descriptor: {
    en: "Execution Environment for Behavioral Logic",
    uk: "Середовище виконання поведінкової логіки",
    fr: "Environnement d'exécution pour la logique comportementale",
    de: "Ausführungsumgebung für Verhaltenslogik",
    it: "Ambiente di esecuzione per la logica comportamentale",
  },
} as const;

export type RuntimeLocale = keyof typeof BLOOM_RUNTIME_IDENTITY.expansion;
