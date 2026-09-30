import {
  Alert,
  AlertActionLink,
  Bullseye,
  Button,
  Content,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  Label,
  Page,
  PageSection,
  SkipToContent,
  Spinner,
  Title,
} from "@patternfly/react-core";
import { ArrowDownIcon } from "@patternfly/react-icons";
import { useQuery } from "@tanstack/react-query";
import { FormattedMessage, useIntl } from "react-intl";

import { loadHomeContent } from "../application/load-home-content";
import type { HomeContent } from "../domain/home-content";
import { ChangelogTable } from "./changelog-table";
import { ContactSection } from "./contact-section";
import { ExternalLink } from "./external-link";
import { HomeMasthead } from "./home-masthead";
import styles from "./home-page.module.css";
import { useHomeRuntime } from "./home-runtime";
import { IncidentsPanel } from "./incidents-panel";
import { InstanceCard } from "./instance-card";
import { messages } from "./messages";
import { NewsPanel } from "./news-panel";
import { StatusSummary } from "./status-summary";

export const homeContentQueryKey = ["home-content"] as const;

/** Status content is refreshed every minute while the page is open. */
export const homeContentRefreshMs = 60_000;

export interface HomePageProps {
  /** Contact shown even when content cannot be loaded. */
  readonly fallbackSlackChannel: string;
}

export function HomePage({ fallbackSlackChannel }: HomePageProps) {
  const intl = useIntl();
  const runtime = useHomeRuntime();
  const query = useQuery({
    queryFn: ({ signal }) => loadHomeContent(runtime, signal),
    queryKey: homeContentQueryKey,
    refetchInterval: homeContentRefreshMs,
    retry: 2,
    staleTime: homeContentRefreshMs,
  });
  const content = query.data;
  const slackChannel = content?.contact.slackChannel ?? fallbackSlackChannel;

  return (
    <Page
      isContentFilled
      mainContainerId="main-content"
      masthead={<HomeMasthead docsUrl={content?.links.docs} />}
      skipToContent={
        <SkipToContent href="#main-content">
          <FormattedMessage {...messages.skipToContent} />
        </SkipToContent>
      }
    >
      <PageSection id="top">
        {content === undefined ? (
          query.isError ? (
            <Alert
              actionLinks={
                <AlertActionLink onClick={() => void query.refetch()}>
                  <FormattedMessage {...messages.retry} />
                </AlertActionLink>
              }
              isInline
              title={intl.formatMessage(messages.loadFailedTitle)}
              variant="danger"
            >
              <FormattedMessage
                {...messages.loadFailedBody}
                values={{ channel: slackChannel }}
              />
            </Alert>
          ) : (
            <Bullseye>
              <Spinner aria-label={intl.formatMessage(messages.loading)} />
            </Bullseye>
          )
        ) : (
          <LoadedContent content={content} isStale={query.isError} />
        )}
      </PageSection>
      <PageSection>
        <ContactSection
          slackChannel={slackChannel}
          slackUrl={content?.contact.slackUrl}
        />
      </PageSection>
      <PageSection component="footer">
        <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
          <Content component="small">
            <FormattedMessage {...messages.footerOwner} />
          </Content>
          {content?.links.source ? (
            <ExternalLink
              href={content.links.source}
              label={intl.formatMessage(messages.footerSource)}
            />
          ) : null}
        </Flex>
      </PageSection>
    </Page>
  );
}

function LoadedContent({
  content,
  isStale,
}: {
  readonly content: HomeContent;
  readonly isStale: boolean;
}) {
  const intl = useIntl();
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapXl" }}>
      {isStale ? (
        <Alert
          isInline
          title={intl.formatMessage(messages.staleTitle)}
          variant="warning"
        >
          <FormattedMessage {...messages.staleBody} />
        </Alert>
      ) : null}

      <Grid hasGutter>
        <GridItem md={7}>
          <Flex
            direction={{ default: "column" }}
            gap={{ default: "gapLg" }}
            justifyContent={{ default: "justifyContentCenter" }}
          >
            <FlexItem>
              <Label color="blue">
                <FormattedMessage {...messages.heroEyebrow} />
              </Label>
            </FlexItem>
            <Title headingLevel="h1" size="4xl">
              <FormattedMessage {...messages.heroTitleLine1} />
              <br />
              <FormattedMessage {...messages.heroTitleLine2} />
            </Title>
            <Content className={styles.lead} component="p">
              <FormattedMessage {...messages.heroLead} />
            </Content>
            <Flex gap={{ default: "gapMd" }}>
              <Button
                component="a"
                href="#instances"
                icon={<ArrowDownIcon />}
                iconPosition="end"
                size="lg"
              >
                <FormattedMessage {...messages.chooseInstance} />
              </Button>
              <ExternalLink
                href={content.contact.slackUrl}
                label={intl.formatMessage(messages.askInSlack, {
                  channel: content.contact.slackChannel,
                })}
                variant="secondary"
              />
            </Flex>
          </Flex>
        </GridItem>
        <GridItem md={5}>
          <StatusSummary content={content} />
        </GridItem>
      </Grid>

      <section aria-labelledby="instances-title" id="instances">
        <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
          <div>
            <Title headingLevel="h2" id="instances-title" size="2xl">
              <FormattedMessage {...messages.instancesTitle} />
            </Title>
            <Content component="p">
              <FormattedMessage {...messages.instancesLead} />
            </Content>
          </div>
          <Grid hasGutter>
            {content.instances.map((instance) => (
              <GridItem key={instance.id} md={6} xl={3}>
                <InstanceCard instance={instance} />
              </GridItem>
            ))}
          </Grid>
          <Alert
            isInline
            isPlain
            title={intl.formatMessage(messages.cliMatchNotice)}
            variant="info"
          />
        </Flex>
      </section>

      <Grid hasGutter>
        <GridItem md={6}>
          <IncidentsPanel content={content} />
        </GridItem>
        <GridItem md={6}>
          <NewsPanel content={content} />
        </GridItem>
      </Grid>

      <ChangelogTable content={content} />
    </Flex>
  );
}
