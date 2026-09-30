import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Content,
  Flex,
  Label,
  type LabelProps,
  List,
  ListItem,
  Title,
} from "@patternfly/react-core";
import { FormattedMessage, useIntl, type MessageDescriptor } from "react-intl";

import {
  latestNews,
  type HomeContent,
  type NewsItem,
} from "../domain/home-content";
import { CalendarDate } from "./dates";
import { ExternalLink } from "./external-link";
import { messages } from "./messages";

// action-required uses the yellow warning family (act to avoid harm);
// new is neutral teal; platform notes use purple (informational).
const kindPresentation: Record<
  NewsItem["kind"],
  {
    color?: LabelProps["color"];
    label: MessageDescriptor;
    status?: LabelProps["status"];
  }
> = {
  "action-required": {
    label: messages.newsActionRequired,
    status: "warning",
  },
  new: { color: "teal", label: messages.newsNew },
  platform: { color: "purple", label: messages.newsPlatform },
};

export function NewsPanel({ content }: { readonly content: HomeContent }) {
  const intl = useIntl();
  const news = latestNews(content, 3);

  return (
    <Card id="news" component="section" isFullHeight>
      <CardHeader>
        <CardTitle component="h2">
          <FormattedMessage {...messages.newsTitle} />
        </CardTitle>
      </CardHeader>
      <CardBody>
        {news.length === 0 ? (
          <Content component="p">
            <FormattedMessage {...messages.noNews} />
          </Content>
        ) : (
          <List isBordered isPlain>
            {news.map((item) => {
              const kind = kindPresentation[item.kind];
              return (
                <ListItem key={item.id}>
                  <Flex
                    direction={{ default: "column" }}
                    gap={{ default: "gapXs" }}
                  >
                    <Flex gap={{ default: "gapSm" }}>
                      <Label color={kind.color} isCompact status={kind.status}>
                        {intl.formatMessage(kind.label)}
                      </Label>
                      <Content component="small">
                        <CalendarDate value={item.publishedOn} />
                      </Content>
                    </Flex>
                    <Title headingLevel="h3" size="md">
                      {item.url ? (
                        <ExternalLink href={item.url} label={item.title} />
                      ) : (
                        item.title
                      )}
                    </Title>
                    <Content component="p">{item.summary}</Content>
                  </Flex>
                </ListItem>
              );
            })}
          </List>
        )}
      </CardBody>
      {content.links.news ? (
        <CardFooter>
          <ExternalLink
            href={content.links.news}
            label={intl.formatMessage(messages.allNews)}
          />
        </CardFooter>
      ) : null}
    </Card>
  );
}
