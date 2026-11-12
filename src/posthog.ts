// PostHog, cookieless, as on build40for40.com. Off when there's no project token.
/* eslint-disable */
const apiKey = import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = import.meta.env.PUBLIC_POSTHOG_HOST;

const withoutHash = (properties?: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (typeof value === "string" && /^https?:\/\//.test(value)) properties![key] = value.split("#")[0];
  }
};

if (apiKey && apiHost) {
  // @ts-ignore The official loader snippet.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  (window.posthog as unknown as { init: (...args: unknown[]) => void }).init(apiKey, {
    api_host: apiHost,
    defaults: "2026-08-30",
    cookieless_mode: "always",
    capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true, capture_console_errors: false },
    before_send: (event: { properties?: Record<string, unknown>; $set?: Record<string, unknown>; $set_once?: Record<string, unknown> } | null) => {
      if (event) [event.properties, event.$set, event.$set_once].forEach(withoutHash);
      return event;
    },
  });
}

export {};
