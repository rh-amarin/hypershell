import { buildOpenShellCliInstallCommand } from "@openshift-online/hypershell-gateway-management-ui";
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  ClipboardCopy,
  ClipboardCopyVariant,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  Label,
} from "@patternfly/react-core";
import { LockIcon } from "@patternfly/react-icons";
import { FormattedMessage, useIntl } from "react-intl";

import type { Instance } from "../domain/home-content";
import { ExternalLink } from "./external-link";
import styles from "./home-page.module.css";
import { messages } from "./messages";
import { StatusLabel } from "./status-label";

export function InstanceCard({ instance }: { readonly instance: Instance }) {
  const intl = useIntl();
  const titleId = `instance-${instance.id}-title`;
  return (
    <Card component="article" aria-labelledby={titleId} isFullHeight>
      <CardHeader>
        <Flex
          gap={{ default: "gapSm" }}
          justifyContent={{ default: "justifyContentSpaceBetween" }}
        >
          <Label color="grey" isCompact>
            {instance.provider}
          </Label>
          <StatusLabel status={instance.status} />
        </Flex>
      </CardHeader>
      <CardTitle component="h3" id={titleId}>
        {instance.name}
      </CardTitle>
      <CardBody>
        <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
          <Content className={styles.instanceDescription} component="p">
            {instance.description}
          </Content>
          <DescriptionList
            horizontalTermWidthModifier={{ default: "10rem" }}
            isCompact
            isHorizontal
          >
            <DescriptionListGroup>
              <DescriptionListTerm>
                <FormattedMessage {...messages.access} />
              </DescriptionListTerm>
              <DescriptionListDescription>
                {instance.requiresVpn ? (
                  <Label color="purple" icon={<LockIcon />} isCompact>
                    <FormattedMessage {...messages.vpnRequired} />
                  </Label>
                ) : (
                  <FormattedMessage {...messages.accessPublic} />
                )}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>
                <FormattedMessage {...messages.region} />
              </DescriptionListTerm>
              <DescriptionListDescription>
                {instance.region}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>
                <FormattedMessage {...messages.openshellVersion} />
              </DescriptionListTerm>
              <DescriptionListDescription>
                <Label color="blue" isCompact>
                  {instance.openshellVersion}
                </Label>
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
          <div>
            <Content component="p" id={`${titleId}-cli`}>
              <FormattedMessage {...messages.matchingCli} />
            </Content>
            <ClipboardCopy
              aria-labelledby={`${titleId}-cli`}
              clickTip={intl.formatMessage(messages.copied)}
              hoverTip={intl.formatMessage(messages.copyCommand)}
              isCode
              isReadOnly
              variant={ClipboardCopyVariant.expansion}
            >
              {buildOpenShellCliInstallCommand(instance.openshellVersion)}
            </ClipboardCopy>
          </div>
        </Flex>
      </CardBody>
      <CardFooter>
        <ExternalLink
          accessibleName={intl.formatMessage(messages.openConsoleFor, {
            instance: instance.name,
          })}
          href={instance.consoleUrl}
          label={intl.formatMessage(messages.openConsole)}
          variant="primary"
        />
      </CardFooter>
    </Card>
  );
}
