import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { ENDPOINTS } from './constants';

// Initialise Discord Integration
export let discordSdk;
export function initaliseDiscord() {
  const params = new URLSearchParams(window.location.href);

  if (params.get('frame_id')) {
    // Patch Service URLs for CSP compatibiltiy with the Discord proxy
    const urlPatches = [
      {
        prefix: '/api',
        target: 'api.mcteamster.com'
      },
      ...Object.keys(ENDPOINTS).map((endpoint) => {
        return {
          prefix: `/${endpoint.toLowerCase()}`,
          target: ENDPOINTS[endpoint].replace('wss://', '')
        }
      }),
      {
        prefix: '/bing',
        target: 'c.bing.com'
      },
      {
        prefix: '/clarity/{subdomain}',
        target: '{subdomain}.clarity.ms'
      },
    ]
    patchUrlMappings(urlPatches);

    // Setup SDK
    discordSdk = new DiscordSDK("1385639813268373587");
    (async () => {
      // Configuration
      await discordSdk.ready();
    })().then(async () => {
      // Usage
      console.info("Discord SDK is ready");
      
      // Purge local state on new sessions
      if (!localStorage.getItem('instance_id') || (localStorage.getItem('instance_id') != discordSdk.instanceId)) {
        localStorage.setItem('gameId', null);
        localStorage.setItem('playerId', null);
        localStorage.setItem('createTime', null);
      }
      localStorage.setItem('instance_id', discordSdk.instanceId)
    });
    return true
  } else {
    console.debug("Not running inside Discord");
    return false
  }
}

