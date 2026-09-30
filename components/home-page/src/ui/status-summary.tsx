import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Content,
  Flex,
  FlexItem,
  List,
  ListItem,
} from "@patternfly/react-core";
import { FormattedMessage, useIntl } from "react-intl";

import type { HomeContent } from "../domain/home-content";
import { Instant } from "./dates";
import { ExternalLink } from "./external-link";
import { messages } from "./messages";
import { StatusLabel } from "./status-label";

export function StatusSummary({ content }: { readonly content: HomeContent }) {
  const intl = useIntl();
  const rows = [
    ...content.instances.map((instance) => ({
      id: `instance-${instance.id}`,
      name: instance.name,
      status: instance.status,
      version: instance.openshellVersion,
    })),
    ...content.services.map((service) => ({
      id: `service-${service.id}`,
      name: service.name,
      status: service.status,
      version: undefined,
    })),
  ];

  return (
    <Card isFullHeight>
      <CardHeader
        actions={{
          actions: (
            <Content component="small">
              <FormattedMessage
                {...messages.updatedAt}
                values={{ time: <Instant value={content.updatedAt} /> }}
              />
            </Content>
          ),
          hasNoOffset: true,
        }}
      >
        <CardTitle component="h2">
          <FormattedMessage {...messages.liveStatus} />
        </CardTitle>
      </CardHeader>
      <CardBody>
        <List isBordered isPlain>
          {rows.map((row) => (
            <ListItem key={row.id}>
              <Flex
                alignItems={{ default: "alignItemsCenter" }}
                justifyContent={{ default: "justifyContentSpaceBetween" }}
              >
                <FlexItem>
                  <div>{row.name}</div>
                  {row.version ? (
                    <Content component="small">
                      <FormattedMessage
                        {...messages.openshellVersionShort}
                        values={{ version: row.version }}
                      />
                    </Content>
                  ) : null}
                </FlexItem>
                <FlexItem>
                  <StatusLabel status={row.status} />
                </FlexItem>
              </Flex>
            </ListItem>
          ))}
        </List>
      </CardBody>
      {content.links.incidentHistory ? (
        <CardFooter>
          <ExternalLink
            href={content.links.incidentHistory}
            label={intl.formatMessage(messages.incidentHistory)}
          />
        </CardFooter>
      ) : null}
    </Card>
  );
}
