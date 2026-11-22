/**
 * Named areas that keep a different IANA zone inside a region, for the
 * multi-zone pages (/time-zone/<region>). The region data (scripts/build-data.mjs)
 * knows which zones a region spans, but its cities come from the whole country,
 * so a zone that only a small area of the region keeps would be shown with cities
 * from other states. An entry here names that area and the places inside the
 * region instead. Offsets, abbreviations and DST months are never written here:
 * src/content/place.ts computes them from the engine (IANA tzdata).
 *
 * Arizona. Sources:
 * - IANA tzdata zone1970.tab: America/Phoenix "MST - AZ (most areas)";
 *   America/Denver "Mountain (most areas)". tzdata `northamerica`: "only the
 *   Navajo Nation participates in the Daylight Saving Time policy" and "See
 *   America/Denver for a zone appropriate for the Navajo Nation"; `backward`
 *   links Navajo and America/Shiprock to America/Denver.
 * - en.wikipedia.org/wiki/Time_in_Arizona: most of the state, except the Navajo
 *   Nation, stays on MST all year; the Navajo Nation lies in northeastern Arizona
 *   and follows the US DST schedule; the Hopi Reservation, entirely surrounded by
 *   the Navajo Nation, does not observe DST.
 * - Window Rock (the Navajo Nation's seat of government), Tuba City, Kayenta and
 *   Chinle are Navajo Nation communities in Arizona.
 */

export interface ZoneArea {
  /** The zone the area keeps, one of the region's zones. */
  tz: string;
  /** "Navajo Nation" */
  name: string;
  /** Where in the region, e.g. "in the northeast". */
  where: string;
  /** Places inside the region on this zone, largest or best known first. */
  places: string[];
}

export interface RegionZoneAreas {
  /** The region's main zone and a named area inside the other zone that keeps it. */
  main: { tz: string; alsoIn: string };
  area: ZoneArea;
  /** Whose DST dates the area follows. */
  dstDates: string;
}

/** Keyed by the region's entity slug (/time-zone/<entity>). */
export const REGION_ZONE_AREAS: Record<string, RegionZoneAreas> = {
  arizona: {
    main: { tz: "America/Phoenix", alsoIn: "the Hopi Reservation" },
    area: {
      tz: "America/Denver",
      name: "Navajo Nation",
      where: "in the northeast",
      places: ["Window Rock", "Tuba City", "Kayenta", "Chinle"],
    },
    dstDates: "the US DST dates",
  },
};
