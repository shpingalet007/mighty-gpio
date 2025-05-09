import { randomBytes } from "node:crypto";
import { clearTimeout } from "node:timers";
import { EventEmitter } from "events";

export class AckEventEmitter extends EventEmitter {
  private static StaleTime = 10000;

  public invoke(eventName: string, ...data: any) {
    const id = Buffer.from(randomBytes(5)).toString("hex");

    return new Promise((resolve: (...args: any[]) => void, reject) => {
      const timeout = setTimeout(() => {
        reject(Error(`AckEvent RES|${id}|${eventName} considered stale`));
      }, AckEventEmitter.StaleTime);

      this.once(`RES|${id}|${eventName}`, (eid: string, ...args) => {
        if (id !== eid) return;

        clearTimeout(timeout);
        resolve(...args);
      });

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
