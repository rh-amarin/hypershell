import {
  Card,
  CardBody,
  Content,
  Flex,
  FlexItem,
  Title,
} from "@patternfly/react-core";
import { HashtagIcon } from "@patternfly/react-icons";
import { FormattedMessage, useIntl } from "react-intl";

import { ExternalLink } from "./external-link";
import { messages } from "./messages";

export interface ContactSectionProps {
  readonly slackChannel: string;
  /** Absent when content failed to load; the channel name still shows. */
  readonly slackUrl?: string;
}

export function ContactSection({
  slackChannel,
  slackUrl,
}: ContactSectionProps) {
  const intl = useIntl();
  return (
    <Card id="contact" component="section">
      <CardBody>
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapLg" }}
        >
          <FlexItem>
            <HashtagIcon aria-hidden="true" />
          </FlexItem>
          <FlexItem flex={{ default: "flex_1" }}>
            <Title headingLevel="h2" size="xl">
              <FormattedMessage
                {...messages.contactTitle}
                values={{ channel: slackChannel }}
              />
            </Title>
            <Content component="p">
              <FormattedMessage {...messages.contactLead} />
            </Content>
          </FlexItem>
          {slackUrl ? (
            <FlexItem>
              <ExternalLink
                href={slackUrl}
                label={intl.formatMessage(messages.openInSlack)}
                variant="primary"
              />
            </FlexItem>
          ) : null}
        </Flex>
      </CardBody>
    </Card>
  );
}
