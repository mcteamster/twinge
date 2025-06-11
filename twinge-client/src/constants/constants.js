export const ENDPOINTS = {
  'AU': 'wss://au.twinge.mcteamster.com',      // Sydney AU 🇦🇺
  'JP': 'wss://jp.twinge.mcteamster.com',      // Tokyo JP 🇯🇵
  'SG': 'wss://sg.twinge.mcteamster.com',      // Singapore SG 🇸🇬
  'IN': 'wss://in.twinge.mcteamster.com',      // Mumbai IN 🇮🇳
  'EU': 'wss://eu.twinge.mcteamster.com',      // Frankfurt EU 🇪🇺
  'UK': 'wss://uk.twinge.mcteamster.com',      // London UK 🇬🇧
  'BR': 'wss://br.twinge.mcteamster.com',      // Sao Paolo BR 🇧🇷
  'US-EAST': 'wss://us-east.twinge.mcteamster.com', // Washington D.C. US 🇺🇸
  'US-WEST': 'wss://us-west.twinge.mcteamster.com', // San Francisco US 🇺🇸
  'DEFAULT': 'wss://eu.mcteamster.com' // Default or Local
}

export const getRegionFromCode = (roomCode) => {
  const lastLetter = roomCode[roomCode.length - 1].toUpperCase();
  let region;

  if ('BC'.includes(lastLetter)) {
    region = 'AU'; // Sydney AU 🇦🇺
  } else if ('DF'.includes(lastLetter)) {
    region = 'JP'; // Tokyo JP 🇯🇵
  } else if ('GH'.includes(lastLetter)) {
    region = 'SG'; // Singapore SG 🇸🇬
  } else if ('JK'.includes(lastLetter)) {
    region = 'IN'; // Mumbai IN 🇮🇳
  } else if ('LM'.includes(lastLetter)) {
    region = 'EU'; // Frankfurt EU 🇪🇺
  } else if ('NP'.includes(lastLetter)) {
    region = 'UK'; // London UK 🇬🇧
  } else if ('QR'.includes(lastLetter)) {
    region = 'BR'; // Sao Paolo BR 🇧🇷
  } else if ('ST'.includes(lastLetter)) {
    region = 'US-EAST'; // Washington D.C. US 🇺🇸
  } else if ('VW'.includes(lastLetter)) {
    region = 'US-WEST'; // San Francisco US 🇺🇸
  } else {
    region = 'DEFAULT';
  }

  console.debug(`Identified Region: ${region}`)
  return region;
}