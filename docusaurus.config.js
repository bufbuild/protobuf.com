// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const gaTrackingID = process.env.GOOGLE_ANALYTICS_GTAG ?? "";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "The Protobuf Language",
  tagline: "A platform-agnostic way to describe data structures and interfaces.",
  url: "https://protobuf.com",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.png",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "bufbuild", // Usually your GitHub org/user name.
  projectName: "protobuf.com", // Usually your repo name.

  scripts: [
    {
      src: "https://sparkling-delightful.protobuf.com/script.js",
      "data-site": "NXKPYXNZ",
      "data-spa": "auto",
      defer: true
    }
  ],

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"]
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js")
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css")
        }
      })
    ]
  ],

  plugins: [
    (gaTrackingID !== "") ?
      ["@docusaurus/plugin-google-gtag",{
        trackingID: gaTrackingID,
        anonymizeIP: true,
      }]:null
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // algolia: {
      //   appId: process.env.ALGOLIA_APP_ID || "none",
      //   apiKey: process.env.ALGOLIA_API_KEY || "none",
      //   indexName: process.env.ALGOLIA_INDEX_NAME || "none"
      // },
      // fathomAnalytics: {
      //   siteId: process.env.FATHOM_ANALYTICS_SITE_ID || "none",
      //   customDomain: process.env.FATHOM_ANALYTICS_CUSTOM_DOMAIN || "none"
      // },
      navbar: {
        title: "Protobuf Guide"
      },
      footer: {
        style: "dark",
        links: [],
        copyright: `Copyright © ${
          new Date().getFullYear() != 2022 ? "2022&ndash;" : ""
        }${new Date().getFullYear()} Buf Technologies, Inc.`
      },
      prism: {
        theme: lightCodeTheme,
        additionalLanguages: ["protobuf", "ebnf"]
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 5
      },
      colorMode: {
        disableSwitch: true
      }
    })
};

module.exports = config;
