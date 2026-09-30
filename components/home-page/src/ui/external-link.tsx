import { Button, type ButtonProps } from "@patternfly/react-core";
import { ExternalLinkAltIcon } from "@patternfly/react-icons";
import { useIntl } from "react-intl";

import { messages } from "./messages";

export interface ExternalLinkProps {
  /**
   * Fuller name for assistive technology. It must start with or contain the
   * visible label (WCAG 2.5.3); defaults to the label.
   */
  readonly accessibleName?: string;
  readonly href: string;
  /** Visible link text. */
  readonly label: string;
  readonly variant?: ButtonProps["variant"];
}

/**
 * A link that opens in a new tab and says so in its accessible name. The hint
 * lives in aria-label rather than a visually hidden span, because PatternFly's
 * screen-reader utility is fixed-positioned and widens scroll containers.
 */
export function ExternalLink({
  accessibleName,
  href,
  label,
  variant = "link",
}: ExternalLinkProps) {
  const intl = useIntl();
  return (
    <Button
      aria-label={intl.formatMessage(messages.linkOpensInNewTab, {
        name: accessibleName ?? label,
      })}
      component="a"
      href={href}
      icon={<ExternalLinkAltIcon />}
      iconPosition="end"
      isInline={variant === "link"}
      rel="noopener noreferrer"
      target="_blank"
      variant={variant}
    >
      {label}
    </Button>
  );
}
