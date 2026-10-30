import {
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Title,
} from "@patternfly/react-core";
import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import type { CommandRunner } from "../../application/terminal/command-runner";
import { HsctlTerminal } from "./hsctl-terminal";
import styles from "./terminal-drawer.module.css";

export const terminalDrawerMessages = defineMessages({
  title: {
    id: "app.terminal.panel.title",
    defaultMessage: "Terminal",
    description: "Heading of the bottom panel that holds the hsctl terminal.",
  },
  resize: {
    id: "app.terminal.panel.resize",
    defaultMessage: "Resize the terminal panel",
    description:
      "Accessible label for the handle that changes the terminal panel height.",
  },
  close: {
    id: "app.terminal.panel.close",
    defaultMessage: "Close the terminal panel",
    description: "Accessible label for the button that closes the panel.",
  },
});

export interface TerminalDrawerProps {
  children: ReactNode;
  isExpanded: boolean;
  onClose: () => void;
  runner: CommandRunner;
}

/**
 * Docks an hsctl terminal to the bottom of the page content. The user drags
 * its top edge to change the height. The terminal loads on first open and
 * then stays mounted, so closing the panel keeps the session and history.
 *
 * PatternFly removes a collapsed panel's children. To survive that, the
 * terminal renders through a portal into one long-lived element, and each
 * time the panel opens that element moves into the panel body.
 */
export function TerminalDrawer({
  children,
  isExpanded,
  onClose,
  runner,
}: TerminalDrawerProps) {
  const intl = useIntl();
  const [opened, setOpened] = useState(isExpanded);
  if (isExpanded && !opened) {
    setOpened(true);
  }
  const [host] = useState(() => {
    if (typeof document === "undefined") {
      return null;
    }
    const element = document.createElement("div");
    element.className = styles.host ?? "";
    return element;
  });
  const attachHost = useCallback(
    (slot: HTMLDivElement | null) => {
      if (slot && host && host.parentElement !== slot) {
        slot.appendChild(host);
      }
    },
    [host],
  );

  const panel = (
    <DrawerPanelContent
      className={styles.panel}
      defaultSize="320px"
      isResizable
      maxSize="85vh"
      minSize="140px"
      resizeAriaLabel={intl.formatMessage(terminalDrawerMessages.resize)}
    >
      <DrawerHead className={styles.head}>
        <Title headingLevel="h2" size="md">
          <FormattedMessage {...terminalDrawerMessages.title} />
        </Title>
        <DrawerActions>
          <DrawerCloseButton
            aria-label={intl.formatMessage(terminalDrawerMessages.close)}
            onClick={onClose}
          />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelBody className={styles.body}>
        <div className={styles.slot} ref={attachHost} />
      </DrawerPanelBody>
    </DrawerPanelContent>
  );

  return (
    <>
      <Drawer isExpanded={isExpanded} isInline position="bottom">
        <DrawerContent panelContent={panel}>
          <DrawerContentBody>{children}</DrawerContentBody>
        </DrawerContent>
      </Drawer>
      {opened && host
        ? createPortal(
            <HsctlTerminal isVisible={isExpanded} runner={runner} />,
            host,
          )
        : null}
    </>
  );
}
