import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { ENDPOINTS } from './constants';

// Initialise Discord Integration
export function initaliseDiscord() {
  if ((new URLSearchParams(window.location.href)).get('frame_id')) {
    // Purge Persistent State
    localStorage.setItem('gameId', null);
    localStorage.setItem('playerId', null);
    localStorage.setItem('createTime', null);

    // Patch Service URLs for CSP compatibiltiy with the Discord proxy
    const urlPatches = Object.keys(ENDPOINTS).map((endpoint) => {
      return {
        prefix: `/${endpoint.toLowerCase()}`,
        target: ENDPOINTS[endpoint].replace('wss://', '')
      }
    })
    patchUrlMappings(urlPatches);

    // Setup SDK
    const discordSdk = new DiscordSDK("1385639813268373587");
    (async () => {
      // Configuration
      await discordSdk.ready();
    })().then(() => {
      // Usage
      console.info("Discord SDK is ready");
    });
    return true
  } else {
    console.debug("Not running inside Discord");
    return false
  }
}

