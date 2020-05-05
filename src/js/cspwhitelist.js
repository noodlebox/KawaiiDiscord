chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    const responseHeaders = details.responseHeaders.map(function(o) {
        const name = o.name;
        if (name !== "content-security-policy") {
            return o;
        }
        let value = o.value;
        value = value.replace(/img-src/i, "img-src https://smutba.se/media/emoji/ https://gitcdn.xyz/repo/jmhobbs/cultofthepartyparrot.com/ https://gitcdn.xyz/cdn/jmhobbs/cultofthepartyparrot.com/");
        value = value.replace(/connect-src/i, "connect-src https://smutba.se/emoji/json/ https://gitcdn.xyz/repo/jmhobbs/cultofthepartyparrot.com/ https://gitcdn.xyz/cdn/jmhobbs/cultofthepartyparrot.com/");
        return {name, value};
    });
    return {responseHeaders};
  },
  // filters
  {
    urls: [
      "https://discord.com/*",
      "https://canary.discord.com/*"
    ],
    types: ["main_frame"]
  },
  ["blocking", "responseHeaders"]);
