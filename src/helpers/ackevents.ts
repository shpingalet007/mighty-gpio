import { randomBytes } from "node:crypto";
import { clearTimeout } from "node:timers";
import { EventEmitter } from "events";

export class AckEventEmitter extends EventEmitter {
  private static StaleTime = 10000;

  public invoke(eventName: string, ...data: any) {
    const id = Buffer.from(randomBytes(5)).toString("hex");

    return new Promise((resolve: (...args: any[]) => void, reject) => {
      const dispatcher = (eid: string, ...args: any[]) => {
        if (id !== eid) return;

        clearTimeout(timeout);
        resolve(...args);
      };

      const timeout = setTimeout(() => {
        // TODO: This event must be killed outside when instance is closed
        console.log(`AckEvent RES|${id}|${eventName} considered stale`);
        this.off(`RES|${id}|${eventName}`, dispatcher);
      }, AckEventEmitter.StaleTime);

      this.once(`RES|${id}|${eventName}`, dispatcher);

      this.emit(`REQ|${eventName}`, id, ...data);
    });
  }

  public handle(eventName: string, callback: (...args: any[]) => any) {
    const self = this;

    this.on(`REQ|${eventName}`, async function (eid: string, ...data: any) {
      self.emit(`RES|${eid}|${eventName}`, eid, callback(...data));
    });
  }

  public unhandle(eventName: string) {
    this.removeAllListeners(`REQ|${eventName}`);
  }
}
