// packages/platform-ui/vite-env-plugin.js
export default function injectEnvPlugin() {
  // Store the config for use in transformIndexHtml
  let configEnv = {};

  return {
    name: 'inject-env',
    configResolved(config) {
      // Store the resolved config for use in transformIndexHtml
      configEnv = config.env;
      console.log('Vite config ENV stored:', configEnv);
    },
    transformIndexHtml(html) {
      console.log('Transform HTML running with configEnv:', configEnv);

      // Extract relevant environment variables
      const envVars = {
        COUCHDB_SERVER_URL: configEnv.VITE_COUCHDB_SERVER || 'injected-server:5984/',
        COUCHDB_SERVER_PROTOCOL: configEnv.VITE_COUCHDB_PROTOCOL || 'http',
        EXPRESS_SERVER_URL: configEnv.VITE_EXPRESS_SERVER || 'injected-express:3000/',
        EXPRESS_SERVER_PROTOCOL: configEnv.VITE_EXPRESS_PROTOCOL || 'http',
        DEBUG: configEnv.VITE_DEBUG === 'true',
        MOCK: configEnv.VITE_MOCK === 'true',
      };

      console.log('Injecting ENV vars:', envVars);

      // Create the script tag to inject at build time
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'text/javascript' },
            children: `console.log("ENV injection running"); window.__SKUILDER_ENV__ = ${JSON.stringify(
              envVars
            )};`,
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}
