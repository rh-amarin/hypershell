import { FormattedDate } from "react-intl";

/** A calendar date (YYYY-MM-DD) shown without shifting it across time zones. */
export function CalendarDate({ value }: { readonly value: string }) {
  return (
    <time dateTime={value}>
      <FormattedDate
        day="numeric"
        month="short"
        timeZone="UTC"
        value={`${value}T00:00:00Z`}
        year="numeric"
      />
    </time>
  );
}

/** An instant shown with its time zone so it is never ambiguous. */
export function Instant({ value }: { readonly value: string }) {
  return (
    <time dateTime={value}>
      <FormattedDate
        day="numeric"
        hour="2-digit"
        minute="2-digit"
        month="short"
        timeZoneName="short"
        value={value}
      />
    </time>
  );
}
