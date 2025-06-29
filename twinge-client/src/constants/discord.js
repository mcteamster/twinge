import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { ENDPOINTS } from './constants';

// Initialise Discord Integration
export function initaliseDiscord() {
  const params = new URLSearchParams(window.location.href);

  if (params.get('frame_id')) {
    // Set Session State for Discord
    sessionStorage.setItem('channel_id', params.get('channel_id'))

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
      })
    ]
    patchUrlMappings(urlPatches);

    // Setup SDK
    const discordSdk = new DiscordSDK("1385639813268373587");
    (async () => {
      // Configuration
      await discordSdk.ready();
    })().then(async () => {
      // Usage
      console.info("Discord SDK is ready");
    });
    return true
  } else {
    console.debug("Not running inside Discord");
    return false
  }
}

