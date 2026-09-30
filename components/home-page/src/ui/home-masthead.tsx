import {
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  Nav,
  NavItem,
  NavList,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Button,
} from "@patternfly/react-core";
import { FormattedMessage, useIntl } from "react-intl";

import productLogo from "../../../../images/brand/logo.png";
import styles from "./home-page.module.css";
import { messages } from "./messages";

const sections = [
  { href: "#instances", label: messages.navInstances },
  { href: "#incidents", label: messages.navIncidents },
  { href: "#news", label: messages.navNews },
  { href: "#changelog", label: messages.navChangelog },
];

export function HomeMasthead({ docsUrl }: { readonly docsUrl?: string }) {
  const intl = useIntl();
  return (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <MastheadLogo className={styles.brand} component="a" href="#top">
            <img
              alt=""
              aria-hidden="true"
              className={styles.brandLogo}
              src={productLogo}
            />
            <FormattedMessage {...messages.productName} />
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar isStatic>
          <ToolbarContent>
            <ToolbarItem>
              <Nav
                aria-label={intl.formatMessage(messages.primaryNavigation)}
                variant="horizontal"
              >
                <NavList>
                  {sections.map((section) => (
                    <NavItem key={section.href} to={section.href}>
                      {intl.formatMessage(section.label)}
                    </NavItem>
                  ))}
                  {docsUrl ? (
                    <NavItem
                      rel="noopener noreferrer"
                      target="_blank"
                      to={docsUrl}
                    >
                      {intl.formatMessage(messages.navDocs)}
                    </NavItem>
                  ) : null}
                </NavList>
              </Nav>
            </ToolbarItem>
            <ToolbarItem align={{ default: "alignEnd" }}>
              <Button component="a" href="#contact" variant="secondary">
                <FormattedMessage {...messages.getHelp} />
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
}
