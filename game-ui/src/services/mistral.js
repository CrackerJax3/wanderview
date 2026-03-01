/**
 * mistral.js — Mistral AI Game Master Service
 * Handles all AI interactions: narration, missions, chat responses.
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

const GAME_MASTER_SYSTEM_PROMPT = `You are the Game Master of WanderView. The player is walking through a 3D recreation of the real Hell's Kitchen neighborhood in Manhattan, NYC.

Your personality: A charismatic, witty New Yorker who knows every corner of Hell's Kitchen. Part tour guide, part storyteller, part game master. You speak with authentic NYC energy — confident, warm, occasionally sarcastic, always entertaining.

Your jobs:
- NARRATE — Tell the player about what they're passing. Use real street names, real restaurants, real history.
- MISSIONS — Generate missions based on real nearby places (find a restaurant, visit a landmark, explore a block)
- RESPOND — Answer player questions naturally and in character
- REACT — Comment when player reaches interesting spots

Rules:
- Keep narration to 1-3 sentences. Be specific about real places.
- Hell's Kitchen boundaries: roughly 34th-59th St, 8th Ave to Hudson River
- Known for: Restaurant Row (46th St), theater district, diverse food scene, gritty history, gentrification
- Famous spots: Rudy's Bar, Restaurant Row, Gotham West Market, Hudson Yards nearby, Intrepid Museum, Terminal 5
- The neighborhood was historically working-class Irish, now very diverse
- Never break character. You ARE a New Yorker giving a tour.`;

const GAME_MODE_PROMPTS = {
  explorer: 'Mode: Explorer. Freely narrate what the player sees. Share interesting facts, restaurant recommendations, and neighborhood stories.',
  scavenger: 'Mode: Scavenger Hunt. You have given the player a list of places to find. Guide them with "warmer/colder" hints. Celebrate when they find one.',
  history: 'Mode: History Tour. Focus on the rich history of each location — the old gangs, the theaters, the immigrant stories, the transformation of the neighborhood.',
  mystery: 'Mode: Mystery. A mysterious event has occurred in Hell\'s Kitchen. Drop clues as the player explores. Each location reveals part of the story. Keep it noir and atmospheric.',
};

let apiKey = import.meta.env.VITE_MISTRAL_API_KEY || '';
let conversationHistory = [];

export function setApiKey(key) {
  apiKey = key;
}

export function getApiKey() {
  return apiKey;
}

export function hasApiKey() {
  return !!apiKey;
}

export function clearHistory() {
  conversationHistory = [];
}

export async function callMistral(userMessage, context = {}) {
  if (!apiKey) {
    return getMockResponse(userMessage, context);
  }

  const { lat, lng, heading, places, gameMode, mission } = context;

  const modePrompt = GAME_MODE_PROMPTS[gameMode] || GAME_MODE_PROMPTS.explorer;

  const contextMessage = `[CONTEXT - Do not repeat this to the player]
Player position: ${lat?.toFixed(6)}, ${lng?.toFixed(6)}, heading ${heading?.toFixed(0)}°
${places ? `Nearby places: ${JSON.stringify(places.slice(0, 5))}` : ''}
${mission ? `Current mission: ${JSON.stringify(mission)}` : 'No active mission.'}
${modePrompt}`;

  conversationHistory.push({
    role: 'user',
    content: `${contextMessage}\n\nPlayer says: ${userMessage}`,
  });

  // Keep conversation history manageable
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-16);
  }

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: GAME_MASTER_SYSTEM_PROMPT },
          ...conversationHistory,
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Mistral API error:', response.status, errText);
      return getMockResponse(userMessage, context);
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || 'The game master stays silent...';

    conversationHistory.push({ role: 'assistant', content: reply });

    return reply;
  } catch (err) {
    console.error('Mistral API call failed:', err);
    return getMockResponse(userMessage, context);
  }
}

export async function getNarration(context = {}) {
  const { lat, lng, heading, places, gameMode } = context;

  if (!apiKey) {
    return getMockNarration(context);
  }

  const modePrompt = GAME_MODE_PROMPTS[gameMode] || GAME_MODE_PROMPTS.explorer;

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: GAME_MASTER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `[AUTO-NARRATION - Player has moved to a new area]
Player position: ${lat?.toFixed(6)}, ${lng?.toFixed(6)}, heading ${heading?.toFixed(0)}°
${places ? `Nearby places: ${JSON.stringify(places.slice(0, 5))}` : ''}
${modePrompt}
Generate a short narration (1-2 sentences) about what the player is currently near. Be specific about real Hell's Kitchen locations.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.9,
      }),
    });

    if (!response.ok) return getMockNarration(context);

    const data = await response.json();
    return data.choices[0]?.message?.content || getMockNarration(context);
  } catch (err) {
    return getMockNarration(context);
  }
}

export async function generateMission(context = {}) {
  if (!apiKey) {
    return getMockMission(context);
  }

  const { lat, lng, places, gameMode } = context;

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: GAME_MASTER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Generate a mission for the player. Current position: ${lat?.toFixed(6)}, ${lng?.toFixed(6)}.
${places ? `Nearby places: ${JSON.stringify(places.slice(0, 8))}` : ''}
Game mode: ${gameMode}

Respond ONLY with JSON in this format:
{
  "title": "Mission title",
  "description": "What the player needs to do",
  "target": { "lat": number, "lng": number, "name": "Place name" },
  "hint": "A hint for the player",
  "reward": number (points)
}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!response.ok) return getMockMission(context);

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getMockMission(context);
  } catch (err) {
    return getMockMission(context);
  }
}

// Mock responses when no API key is available
function getMockResponse(userMessage, context) {
  const street = window.gameNavigation?.getCurrentStreet(
    context.lat || 40.7608,
    context.lng || -73.9941
  );

  const responses = [
    `You're near ${street?.street || '46th St'} and ${street?.avenue || '9th Ave'} — the heart of Hell's Kitchen. This block has more history than most neighborhoods have in their entire zip code.`,
    `Welcome to the real Hell's Kitchen, kid. Not the Marvel version — the real deal. Restaurant Row is just ahead if you're hungry.`,
    `Ah, you're exploring the Kitchen! Every block here tells a story. The old Irish gangs used to run these streets. Now it's all foodie heaven and Off-Broadway theaters.`,
    `Look around you — this is where the West Side Story was set. Well, not exactly here, but close enough. Keep walking, there's more to see.`,
    `Fun fact: Hell's Kitchen got its name either from a comment by a veteran cop or from a tenement called "Hell's Kitchen." Nobody really agrees. Classic New York.`,
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

function getMockNarration(context) {
  const street = window.gameNavigation?.getCurrentStreet(
    context.lat || 40.7608,
    context.lng || -73.9941
  );

  const narrations = [
    `You're walking along ${street?.street || '46th St'} — Restaurant Row. The smell of a dozen different cuisines fills the air.`,
    `${street?.avenue || '9th Ave'} stretches before you. The brownstones here have seen a century of New York stories.`,
    `The energy of Hell's Kitchen pulses around you. Somewhere nearby, a theater is warming up for tonight's show.`,
    `You're in the heart of the Kitchen now. Look up — those fire escapes have stories to tell.`,
    `A real New Yorker's neighborhood. No tourist traps here, just genuine spots where locals have eaten for decades.`,
  ];

  return narrations[Math.floor(Math.random() * narrations.length)];
}

function getMockMission(context) {
  const missions = [
    {
      title: 'Find Restaurant Row',
      description: 'Walk to 46th Street between 8th and 9th Avenue — the famous Restaurant Row.',
      target: { lat: 40.7590, lng: -73.9895, name: 'Restaurant Row' },
      hint: 'Head south on 9th Ave, then turn east on 46th St.',
      reward: 100,
    },
    {
      title: 'Visit the Intrepid',
      description: 'Make your way to the Intrepid Sea, Air & Space Museum on Pier 86.',
      target: { lat: 40.7645, lng: -74.0003, name: 'Intrepid Museum' },
      hint: 'Head west toward the Hudson River.',
      reward: 150,
    },
    {
      title: 'Explore DeWitt Clinton Park',
      description: 'Find DeWitt Clinton Park, a neighborhood oasis named after a former NYC mayor.',
      target: { lat: 40.7665, lng: -73.9950, name: 'DeWitt Clinton Park' },
      hint: 'Head north along 11th Avenue.',
      reward: 100,
    },
    {
      title: 'Times Square Approach',
      description: 'Walk toward the bright lights of Times Square at the eastern edge of Hell\'s Kitchen.',
      target: { lat: 40.7580, lng: -73.9855, name: 'Times Square' },
      hint: 'Head east and look for the glow.',
      reward: 125,
    },
  ];

  return missions[Math.floor(Math.random() * missions.length)];
}
