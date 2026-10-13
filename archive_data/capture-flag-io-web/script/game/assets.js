// SPDX-License-Identifier: MIT
import { playerWidth, playerHeight, flagWidth, flagHeight } from "./constants.js";
import { state } from "./state.js";

const assetsBase = new URL("../../assets/", import.meta.url);
const defaultMusicTrack = new URL("music/evansong1.wav", assetsBase).href;

export const skins = [
    null,
    new Image(playerWidth, playerHeight),
    new Image(playerWidth, playerHeight),
    new Image(playerWidth, playerHeight)
];

skins[1].src = new URL("skins/skin1.png", assetsBase).href;
skins[2].src = new URL("skins/skin2.png", assetsBase).href;
skins[3].src = new URL("skins/skin3.png", assetsBase).href;

export const redFlagImage = new Image(flagWidth, flagHeight);
redFlagImage.src = new URL("redflag.png", assetsBase).href;
export const blueFlagImage = new Image(flagWidth, flagHeight);
blueFlagImage.src = new URL("blueflag.png", assetsBase).href;

export const audio = {
    maps: {
        "map1": {
            "bgm": new Audio(defaultMusicTrack)
        },
        "map2": {
            "bgm": new Audio(defaultMusicTrack)
        }
    }
};

let fadeRequestId = null;
let musicTracks = [];
let musicCycleIndex = -1;
let tracksLoaded = false;

function applyTrackForAllMaps(trackPath) {
    Object.values(audio.maps).forEach(map => {
        if (!map.bgm) return;
        map.bgm.pause();
        map.bgm.currentTime = 0;
        map.bgm.src = trackPath;
        map.bgm.loop = true;
        map.bgm.load();
    });
}

export async function loadMusicTracks() {
    if (tracksLoaded) return musicTracks;
    try {
        const response = await fetch(new URL("music/tracks.json", assetsBase));
        const data = await response.json();
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
            musicTracks = data.tracks.map(track => new URL(track, assetsBase).href);
        }
    } catch (error) {
        console.error("Failed to load music tracks:", error);
    }

    if (musicTracks.length === 0) {
        musicTracks = [defaultMusicTrack];
    }

    tracksLoaded = true;
    return musicTracks;
}

export function getMusicCycleState() {
    if (musicCycleIndex < 0) {
        return { muted: true, label: "Muted" };
    }
    const trackName = musicTracks[musicCycleIndex]?.split('/').pop() || `Track ${musicCycleIndex + 1}`;
    return { muted: false, label: trackName };
}

export function setMusicMutedByDefault() {
    musicCycleIndex = -1;
    muteBGM(true);
}

export function cycleBGMTrack() {
    if (musicTracks.length === 0) {
        musicTracks = [defaultMusicTrack];
    }

    musicCycleIndex += 1;
    if (musicCycleIndex >= musicTracks.length) {
        musicCycleIndex = -1;
        muteBGM(true);
        return getMusicCycleState();
    }

    applyTrackForAllMaps(musicTracks[musicCycleIndex]);
    muteBGM(false);
    startBGM();
    return getMusicCycleState();
}

export function startBGM() {
    const currentMap = state.game.currentMap;
    if (audio.maps[currentMap] && audio.maps[currentMap].bgm) {
        audio.maps[currentMap].bgm.loop = true;
        if (typeof audio.maps[currentMap].bgm.volume !== "number") {
            audio.maps[currentMap].bgm.volume = 1;
        }
        audio.maps[currentMap].bgm.play().catch(e => console.log("BGM play failed:", e));
    }
}

export function muteBGM(mute) {
    Object.values(audio.maps).forEach(map => {
        if (map.bgm) {
            map.bgm.muted = mute;
        }
    });
}

export function fadeBGMTo(targetVolume, durationMs = 700) {
    if (fadeRequestId) {
        cancelAnimationFrame(fadeRequestId);
        fadeRequestId = null;
    }

    const firstMap = Object.values(audio.maps).find(map => map.bgm);
    const startVolume = firstMap && typeof firstMap.bgm.volume === "number" ? firstMap.bgm.volume : 1;
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));
    const startTime = performance.now();

    const step = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
        const volume = startVolume + (clampedTarget - startVolume) * t;
        Object.values(audio.maps).forEach(map => {
            if (map.bgm) {
                map.bgm.volume = volume;
            }
        });
        if (t < 1) {
            fadeRequestId = requestAnimationFrame(step);
        } else {
            fadeRequestId = null;
        }
    };

    fadeRequestId = requestAnimationFrame(step);
}
