import { describe, expect, it } from 'vitest'
import { groupRuns, toggleLink } from './superset'

const items = (...g: (number | null)[]) => g.map((group_no, i) => ({ id: i + 1, group_no }))

describe('groupRuns', () => {
  it('erkennt Läufe gleicher Nummer und vergibt Buchstaben und Positionen', () => {
    const r = groupRuns(items(1, 1, null, 2, 2, 2))
    expect(r.map((x) => x && `${x.letter}${x.pos}/${x.size}`)).toEqual([
      'A1/2',
      'A2/2',
      null,
      'B1/3',
      'B2/3',
      'B3/3',
    ])
  })

  it('ignoriert einzelne Einträge und zerrissene Gruppen', () => {
    expect(groupRuns(items(1, null, 1))).toEqual([null, null, null])
    expect(groupRuns(items(3))).toEqual([null])
  })
})

describe('toggleLink', () => {
  it('verbindet zwei freie Übungen mit einer neuen Nummer', () => {
    expect(toggleLink(items(null, null, 4), 0)).toEqual([
      { id: 1, group_no: 5 },
      { id: 2, group_no: 5 },
    ])
  })

  it('hängt die nächste Übung an eine bestehende Gruppe', () => {
    expect(toggleLink(items(2, 2, null), 1)).toEqual([{ id: 3, group_no: 2 }])
  })

  it('löst ein Paar vollständig', () => {
    expect(toggleLink(items(1, 1), 0)).toEqual([
      { id: 2, group_no: null },
      { id: 1, group_no: null },
    ])
  })

  it('teilt eine Dreiergruppe: hinten bleibt ein Paar mit neuer Nummer', () => {
    expect(toggleLink(items(1, 1, 1, 1), 0)).toEqual([
      { id: 2, group_no: 2 },
      { id: 3, group_no: 2 },
      { id: 4, group_no: 2 },
      { id: 1, group_no: null },
    ])
  })

  it('tut nichts am Ende der Liste', () => {
    expect(toggleLink(items(null, null), 1)).toEqual([])
  })
})
