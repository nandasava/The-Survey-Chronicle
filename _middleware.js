export async function onRequest(context) {
  const response = await context.next();

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const adsenseScript = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2567436185377293" crossorigin="anonymous"></script>`;

  class HeadInjector {
    element(element) {
      element.append(adsenseScript, { html: true });
    }
  }

  return new HTMLRewriter()
    .on("head", new HeadInjector())
    .transform(response);
}
