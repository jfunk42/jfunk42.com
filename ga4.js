const measurementId = "G-FZTKM111K5";

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag() {
  window.dataLayer.push(arguments);
};

window.gtag("js", new Date());
window.gtag("config", measurementId);

const analyticsScript = document.createElement("script");
analyticsScript.async = true;
analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
document.head.append(analyticsScript);
