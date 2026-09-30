import type { DomainProbePublisher } from "@openshift-online/hypershell-domain-probes";
import {
  FanOutDomainProbePublisher,
  type DomainProbeSink,
  type ProbeDeliveryFailure,
} from "@openshift-online/hypershell-domain-probes/fan-out";

import type { HomeProbe } from "../../application/load-home-content";

export interface HomeObservability {
  readonly publisher: DomainProbePublisher<HomeProbe>;
  /** Most recent probes, newest last; bounded for support diagnostics. */
  recent(): readonly HomeProbe[];
  deliveryFailures(): readonly ProbeDeliveryFailure[];
}

export interface HomeObservabilityOptions {
  readonly mark?: (name: string) => void;
  readonly recentLimit?: number;
}

/**
 * Fans home page probes out to a bounded in-memory recorder and to browser
 * performance marks. Delivery failures are counted, never thrown.
 */
export function createHomeObservability(
  options: HomeObservabilityOptions = {},
): HomeObservability {
  const limit = options.recentLimit ?? 50;
  const recentProbes: HomeProbe[] = [];
  const failures: ProbeDeliveryFailure[] = [];

  const recentSink: DomainProbeSink<HomeProbe> = {
    id: "recent",
    publish(probe) {
      recentProbes.push(probe);
      if (recentProbes.length > limit) {
        recentProbes.shift();
      }
    },
  };
  const performanceSink: DomainProbeSink<HomeProbe> = {
    id: "performance",
    publish(probe) {
      options.mark?.(probe.name);
    },
  };

  const publisher = new FanOutDomainProbePublisher<HomeProbe>({
    failureReporter: {
      report(failure) {
        failures.push(failure);
        if (failures.length > limit) {
          failures.shift();
        }
      },
    },
    sinks: [recentSink, performanceSink],
  });

  return {
    deliveryFailures: () => [...failures],
    publisher,
    recent: () => [...recentProbes],
  };
}
