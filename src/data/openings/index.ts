import italianGame from './italian-game.json'
import ruyLopez from './ruy-lopez.json'
import londonSystem from './london-system.json'
import queensGambit from './queens-gambit.json'
import kingsIndian from './kings-indian.json'
import sicilianNajdorf from './sicilian-najdorf.json'
import caroKann from './caro-kann.json'
import frenchDefense from './french-defense.json'
import pircDefense from './pirc-defense.json'
import scandinavian from './scandinavian.json'
import type { OpeningData } from '@/types'

export const openings: OpeningData[] = [
  italianGame as OpeningData,
  ruyLopez as OpeningData,
  londonSystem as OpeningData,
  queensGambit as OpeningData,
  kingsIndian as OpeningData,
  sicilianNajdorf as OpeningData,
  caroKann as OpeningData,
  frenchDefense as OpeningData,
  pircDefense as OpeningData,
  scandinavian as OpeningData,
]
