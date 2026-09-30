import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Content,
  Label,
} from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { FormattedMessage, useIntl } from "react-intl";

import { latestChanges, type HomeContent } from "../domain/home-content";
import { CalendarDate } from "./dates";
import { ExternalLink } from "./external-link";
import { messages } from "./messages";

export function ChangelogTable({ content }: { readonly content: HomeContent }) {
  const intl = useIntl();
  const changes = latestChanges(content, 6);
  const columns = {
    change: intl.formatMessage(messages.changelogChange),
    component: intl.formatMessage(messages.changelogComponent),
    date: intl.formatMessage(messages.changelogDate),
    pullRequest: intl.formatMessage(messages.changelogPullRequest),
    type: intl.formatMessage(messages.changelogType),
  };

  return (
    <Card id="changelog" component="section">
      <CardHeader>
        <CardTitle component="h2">
          <FormattedMessage {...messages.changelogTitle} />
        </CardTitle>
      </CardHeader>
      <CardBody>
        {changes.length === 0 ? (
          <Content component="p">
            <FormattedMessage {...messages.noChanges} />
          </Content>
        ) : (
          <Table aria-label={columns.change} variant="compact">
            <Thead>
              <Tr>
                <Th width={15}>{columns.date}</Th>
                <Th width={10}>{columns.type}</Th>
                <Th>{columns.change}</Th>
                <Th width={15}>{columns.component}</Th>
                <Th width={10}>{columns.pullRequest}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {changes.map((change) => (
                <Tr key={change.pullRequest}>
                  <Td dataLabel={columns.date}>
                    <CalendarDate value={change.date} />
                  </Td>
                  <Td dataLabel={columns.type}>
                    <Label color="grey" isCompact>
                      {change.type}
                    </Label>
                  </Td>
                  <Td dataLabel={columns.change}>{change.summary}</Td>
                  <Td dataLabel={columns.component}>{change.component}</Td>
                  <Td dataLabel={columns.pullRequest}>
                    <ExternalLink
                      href={change.url}
                      label={intl.formatMessage(messages.pullRequestLink, {
                        number: change.pullRequest,
                      })}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </CardBody>
      {content.links.changelog ? (
        <CardFooter>
          <ExternalLink
            href={content.links.changelog}
            label={intl.formatMessage(messages.fullChangelog)}
          />
        </CardFooter>
      ) : null}
    </Card>
  );
}
