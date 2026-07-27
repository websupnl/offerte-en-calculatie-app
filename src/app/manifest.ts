import type { MetadataRoute } from "next";

/**
 * PWA-manifest. Bewust neutraal gehouden: één app, twee bedrijven — het
 * icoon en de naam mogen niet met de company-switcher meeveranderen, want
 * dan verspringt het pictogram op je beginscherm.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Werkplek — WebsUp & Koolhaas",
    short_name: "Werkplek",
    description: "Offertes, projecten, taken, notities en agenda op één plek.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    lang: "nl",
    // Let op: dit zijn de bestaande WebsUp-logo's (200x201 en 500x500), niet
    // exact 192/512. Browsers schalen ze, maar voor een scherp beginscherm-icoon
    // kun je hier beter echte 192/512-exports neerzetten.
    icons: [
      { src: "/icons/icon-192.png", sizes: "200x201", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "500x500", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "500x500", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nieuwe taak", url: "/tasks", description: "Snel iets opschrijven" },
      { name: "Agenda", url: "/agenda", description: "Wat staat er vandaag" },
      { name: "Notities", url: "/notes", description: "Aantekeningen" },
    ],
  };
}
