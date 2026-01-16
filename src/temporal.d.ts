/**
 * Type declarations for the Temporal API
 * https://tc39.es/proposal-temporal/docs/
 */

declare namespace Temporal {
  export class Instant {
    static from(item: string | Instant): Instant;
    static fromEpochMilliseconds(epochMilliseconds: number): Instant;
    static fromEpochNanoseconds(epochNanoseconds: bigint): Instant;

    readonly epochMilliseconds: number;
    readonly epochNanoseconds: bigint;

    toString(): string;
    toZonedDateTimeISO(timeZone: string): ZonedDateTime;
  }

  export class ZonedDateTime {
    static from(item: ZonedDateTimeLike | string): ZonedDateTime;

    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
    readonly epochNanoseconds: bigint;

    toInstant(): Instant;
  }

  export class PlainDateTime {
    static from(item: string | PlainDateTimeLike): PlainDateTime;

    toZonedDateTime(timeZone: string): ZonedDateTime;
  }

  export class PlainDate {
    static from(item: string | PlainDateLike): PlainDate;

    readonly year: number;
    readonly month: number;
    readonly day: number;

    toZonedDateTime(timeZone: string): ZonedDateTime;
  }

  export interface ZonedDateTimeLike {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
    microsecond?: number;
    nanosecond?: number;
    timeZone: string;
  }

  export interface PlainDateTimeLike {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  }

  export interface PlainDateLike {
    year: number;
    month: number;
    day: number;
  }

  export namespace Now {
    export function instant(): Instant;
    export function plainDateISO(): PlainDate;
  }
}
