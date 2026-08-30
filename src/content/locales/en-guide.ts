/**
 * L3: guidebook text, English.
 *
 * Same voice as the Russian, not a word-for-word translation of it: someone who
 * has been here a while, writing for whoever turns up next. Tired, specific,
 * occasionally sharp. Section 8 stays dry.
 */

import type { LocaleString } from '@core/i18n';
import type { GuideKey } from './ru-guide';

export const EN_GUIDE: Record<GuideKey, LocaleString> = {
  'guide.place.title': '1. Where you are and what to do',
  'guide.place.p1':
    'The rooms are identical. Not similar — identical. You will walk through twenty of them ' +
    'and have no idea whether you went forward or in a circle. That is normal. That is how ' +
    'this place is built.',
  'guide.place.p2':
    'The job is simple: do not starve, do not dry out, do not get caught, find the way down. ' +
    'The way down is a dark patch on the floor with a lit edge. Stand on it and press the ' +
    'interact key. Below is another level: colder, darker, worse.',
  'guide.place.p3':
    'Navigate by landmarks. Every few halls there is something that exists nowhere else: ' +
    'standing water, a heap of somebody else\'s things, a hall of columns, a room with no ' +
    'living lamp in it. Remember those. There is nothing else here to remember — there is no ' +
    'map and there will not be one.',
  'guide.place.p4':
    'Dead is dead. Next time the building assembles itself differently. Nothing you learned ' +
    'about particular corners will help. Only what you learned about yourself will.',

  'guide.body.title': '2. Condition',
  'guide.body.p1':
    'Five bars, bottom left. The two large ones — body and breath — you watch constantly. ' +
    'The three small ones — food, water, nerve — tick slowly and forgive nothing.',
  'guide.body.p2':
    'Water runs out first: a full one lasts about {thirstMinutes} minutes. Food, about ' +
    '{hungerMinutes}. Running burns both roughly {sprintFactor} times faster. When either bar ' +
    'reaches zero you start losing health and you do not stop.',
  'guide.body.p3':
    'Health comes back on its own, slowly, and only while you are neither hungry nor thirsty — ' +
    'above half on both. Gauze and the tin are faster.',
  'guide.body.p4':
    'Breath pays for running and for every swing. A full one is about {sprintSeconds} seconds ' +
    'of running. It returns at around {breathBack} a second, and roughly {crouchFactor} times ' +
    'faster while crouched. Empty it and you cannot run until you have got it back, and you ' +
    'cannot swing either.',
  'guide.body.p5':
    'Nerve drops in the dark, in complete silence — anything quieter than {silenceSeconds} ' +
    'seconds of nothing — and near anything living, harder the closer it is. It recovers by ' +
    'itself when none of that applies, faster if you stand still.',
  'guide.body.p6':
    'Below {nervePercent} percent it gets unpleasant: shapes at the edge of sight that are not ' +
    'there, the hum of the lamps going sour, whispering. None of that kills you by itself. ' +
    'What kills you is losing track of which part is real.',

  'guide.light.title': '3. Light and dark',
  'guide.light.p1':
    'Lamps come three ways: burning, flickering, dead. A flickering one is a lamp that works ' +
    'and will go out at the wrong moment. Do not plan around it.',
  'guide.light.p2':
    'Under a lamp you can see about {litTiles} metres. In full dark, {darkTiles}. That is not a ' +
    'figure of speech: you will not see what you walked into.',
  'guide.light.p3':
    'The flashlight has to be in your hand and switched on. It lasts about {torchMinutes} ' +
    'minutes of steady burning; a battery adds roughly {batteryMinutes} more. Switch it off in ' +
    'a lit corridor. It is the only economy that works down here.',
  'guide.light.p4':
    'Light does not pass through walls — not yours, not a lamp\'s. You will not see a lit hall ' +
    'behind a wall until you are standing in the doorway. Down a straight corridor, though, ' +
    'you can see a long way, and that is the best way to pick a direction.',

  'guide.sound.title': '4. Sound',
  'guide.sound.p1':
    'Everything you do is audible. A footstep carries about {walkTiles} metres. Running, ' +
    '{sprintTiles}. Crouched, nothing at all: that is your main tool, not your spare one.',
  'guide.sound.p2':
    'Wet carpet gives you away — every step on it is about {wetFactor} times louder. Searching ' +
    'a crate is loud and slow. A thrown thing makes its noise where it lands, not where you ' +
    'threw it from, and that is the whole of what passes for cleverness here.',
  'guide.sound.p3':
    'Walls muffle. Two walls away, almost nothing hears you. So when you run, do not run ' +
    'straight — go round a corner, and then another one.',
  'guide.sound.p4':
    'The other side of it: complete silence eats your nerve. Sometimes it is worth making ' +
    'noise on purpose. Just remember what noise brings.',

  'guide.creatures.title': '5. What else is here',
  'guide.creatures.p1':
    'There are not many of them and they are not the same. Tell them apart by what they do, ' +
    'not by what they look like. What you do next depends on it.',
  'guide.creatures.p2':
    'The first wanders on its own and sees nothing. It hears. It will come to where the sound ' +
    'was, mill about, and lose interest. Crouch and stay still and it leaves. You can kill it. ' +
    'There is no reason to.',
  'guide.creatures.p3':
    'The second sees. Once it has you it runs, and it runs faster than you do. Running in a ' +
    'straight line is pointless. What works is breaking its line of sight, getting round a ' +
    'corner, going quiet and waiting. It tires and has to stop. Wait for that.',
  'guide.creatures.p4':
    'The third does not move at all. It stands there, and anything that touches it dies at ' +
    'once. You can see it in the dark — a dark patch with a wide ring around it. The ring is ' +
    'the warning. Walk around.',
  'guide.creatures.p5':
    'Any of them near you eats at your nerve even when it never touches you. Do not stand and ' +
    'watch.',

  'guide.combat.title': '6. Fighting',
  'guide.combat.p1':
    'You do not swing with a key. While anything is inside your weapon\'s reach you swing by ' +
    'yourself, as fast as the weapon allows. The reach shows as a ring around you the moment ' +
    'something steps into it. The second ring, the one closing in, is the time to your next ' +
    'swing.',
  'guide.combat.p2':
    'Bare hands reach about {handsTiles} metres, a pipe about {pipeTiles}. A swing catches ' +
    'everything in the circle, not one of them.',
  'guide.combat.p3':
    'You pay for that. One of them costs about {swingCost} breath a swing. Every extra body in ' +
    'the circle adds roughly {extraCost} more. Against five, your breath buys two swings and ' +
    'then you are just standing there. That is how people die here.',
  'guide.combat.p4':
    'The noise scales the same way. A plain swing carries about {noiseTiles} metres, and each ' +
    'extra body caught adds around {extraNoiseTiles}. The crowd you are cutting through calls ' +
    'the next one.',
  'guide.combat.p5':
    'Sometimes you turn a hit aside. A turned hit does not land at all — not half of it, all ' +
    'of it. But you can only do it to one hit about every {blockSeconds} seconds, it costs ' +
    'breath, and with no breath it does not happen. If three of them hit you at once, you turn ' +
    'aside one.',
  'guide.combat.p6':
    'A weapon blunts with every swing, hits weaker as it goes, and eventually comes apart. ' +
    'A broken one is bare hands. So: two of them you can cut down and walk away breathing. ' +
    'Five, no. A fast one, alone, head on, no. Crouch, go around, do not start.',

  'guide.items.title': '7. Things',
  'guide.items.p1':
    'The bag is a {width} by {height} grid. Things take up different numbers of cells: a pipe ' +
    'lies in a long strip, a battery is one square. Identical things stack.',
  'guide.items.p2':
    'There is a weight limit: {capacity}. You hit it before you run out of room. A pipe is ' +
    'heavy. Decide what you need more — to hit things, or to get there.',
  'guide.items.p3':
    'The hand slot is separate. You eat, drink, light, swing and throw out of it. Right click ' +
    'an item in the bag to put it in hand. Empty hands means no fighting at all.',
  'guide.items.p4':
    'Crates are not searched instantly. What is inside spills onto the floor and has to be ' +
    'picked up one piece at a time. Often there is nothing in them. That is normal too.',

  'guide.controls.title': '8. Controls',
  'guide.controls.p1': 'Keys can be changed in the settings. What is shown here is current.',
};
