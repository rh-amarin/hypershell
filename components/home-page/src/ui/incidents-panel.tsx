import {
  Alert,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Content,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Flex,
  Title,
} from "@patternfly/react-core";
import { FormattedMessage, useIntl, type MessageDescriptor } from "react-intl";

import {
  activeIncidents,
  pastIncidents,
  type HomeContent,
  type Incident,
} from "../domain/home-content";
import { Instant } from "./dates";
import { ExternalLink } from "./external-link";
import { messages } from "./messages";

const phaseMessage: Record<Incident["phase"], MessageDescriptor> = {
  identified: messages.phaseIdentified,
  investigating: messages.phaseInvestigating,
  monitoring: messages.phaseMonitoring,
  resolved: messages.resolvedIncident,
};

function affectedInstances(content: HomeContent, incident: Incident) {
  return incident.instanceIds
    .map(
      (id) =>
        content.instances.find((instance) => instance.id === id)?.name ?? id,
    )
    .join(", ");
}

export function IncidentsPanel({ content }: { readonly content: HomeContent }) {
  const intl = useIntl();
  const active = activeIncidents(content);
  const past = pastIncidents(content, 3);

  return (
    <Card id="incidents" component="section" isFullHeight>
      <CardHeader>
        <CardTitle component="h2">
          <FormattedMessage {...messages.incidentsTitle} />
        </CardTitle>
      </CardHeader>
      <CardBody>
        <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
          {active.length === 0 ? (
            <Alert
              isInline
              isPlain
              title={intl.formatMessage(messages.noActiveIncidents)}
              variant="success"
            />
          ) : (
            active.map((incident) => (
              <Alert
                isInline
                key={incident.id}
                title={intl.formatMessage(messages.activeIncidentTitle, {
                  phase: intl.formatMessage(phaseMessage[incident.phase]),
                  title: incident.title,
                })}
                variant={incident.kind === "maintenance" ? "info" : "warning"}
              >
                <Content component="p">{incident.update}</Content>
                <Content component="small">
                  <FormattedMessage
                    {...(incident.instanceIds.length > 0
                      ? messages.activeIncidentStartedAffecting
                      : messages.activeIncidentStarted)}
                    values={{
                      instances: affectedInstances(content, incident),
                      time: <Instant value={incident.startedAt} />,
                    }}
                  />
                </Content>
              </Alert>
            ))
          )}
          <div>
            <Title headingLevel="h3" size="md">
              <FormattedMessage {...messages.pastIncidents} />
            </Title>
            {past.length === 0 ? (
              <Content component="p">
                <FormattedMessage {...messages.noPastIncidents} />
              </Content>
            ) : (
              <DataList
                aria-label={intl.formatMessage(messages.pastIncidents)}
                isCompact
              >
                {past.map((incident) => (
                  <DataListItem key={incident.id}>
                    <DataListItemRow>
                      <DataListItemCells
                        dataListCells={[
                          <DataListCell key="title">
                            <div>{incident.title}</div>
                            <Content component="small">
                              <FormattedMessage
                                {...(incident.instanceIds.length > 0
                                  ? messages.pastIncidentMetaAffecting
                                  : messages.pastIncidentMeta)}
                                values={{
                                  instances: affectedInstances(
                                    content,
                                    incident,
                                  ),
                                  state: intl.formatMessage(
                                    incident.kind === "maintenance"
                                      ? messages.completedMaintenance
                                      : messages.resolvedIncident,
                                  ),
                                  time: (
                                    <Instant
                                      value={
                                        incident.resolvedAt ??
                                        incident.startedAt
                                      }
                                    />
                                  ),
                                }}
                              />
                            </Content>
                          </DataListCell>,
                        ]}
                      />
                    </DataListItemRow>
                  </DataListItem>
                ))}
              </DataList>
            )}
          </div>
        </Flex>
      </CardBody>
      {content.links.incidentHistory ? (
        <CardFooter>
          <ExternalLink
            href={content.links.incidentHistory}
            label={intl.formatMessage(messages.fullIncidentHistory)}
          />
        </CardFooter>
      ) : null}
    </Card>
  );
}
