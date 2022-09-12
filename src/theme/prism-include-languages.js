import siteConfig from "@generated/docusaurus.config";
export default function prismIncludeLanguages(PrismObject) {
  const {
    themeConfig: { prism }
  } = siteConfig;
  const { additionalLanguages } = prism;
  // Prism components work on the Prism instance on the window, while prism-
  // react-renderer uses its own Prism instance. We temporarily mount the
  // instance onto window, import components to enhance it, then remove it to
  // avoid polluting global namespace.
  // You can mutate PrismObject: registering plugins, deleting languages... As
  // long as you don't re-assign it
  globalThis.Prism = PrismObject;
  additionalLanguages.forEach((lang) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(`prismjs/components/prism-${lang}`);
  });

  // Go-style EBNF (https://pkg.go.dev/golang.org/x/exp/ebnf)
  // is a little different than EBNF that Prism supports.
  PrismObject.languages.ebnf.string.pattern = /"[^"\r\n]*"|`[^`\r\n]*`/; // support back-tick string, not single-quote
  PrismObject.languages.ebnf.operator.pattern = /[-=…|*/!.]/; // '…' is a range operator; '.' is end of rule
  PrismObject.languages.ebnf.definition.pattern = /(?:^|\.)([\t ]*)[a-z]\w*(?:[ \t]+[a-z]\w*)*(?=\s*=)/im
  delete globalThis.Prism;
}
