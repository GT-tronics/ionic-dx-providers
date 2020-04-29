import {Injectable} from '@angular/core';
import {Subject, Subscription} from 'rxjs';

export type EventHandler = (...args: any[]) => any;

@Injectable({
  providedIn: 'root',
})
export class Events {
  private c = new Map<string, EventHandler[]>();

  constructor() 
  {
//     console.warn(`[DEPRECATION][Events]: The Events provider is deprecated and it will be removed in the next major release.
//   - Use "Observables" for a similar pub/sub architecture: https://angular.io/guide/observables
//   - Use "Redux" for advanced state management: https://ngrx.io`);
  }

  /**
   * Subscribe to an event topic. Events that get posted to that topic will trigger the provided handler.
   *
   * @param topic the topic to subscribe to
   * @param handler the event handler
   */
  subscribe(topic: string, ...handlers: EventHandler[]) {
    let topics = this.c.get(topic);
    if (!topics) {
      this.c.set(topic, topics = []);
    }
    topics.push(...handlers);
  }

  /**
   * Unsubscribe from the given topic. Your handler will no longer receive events published to this topic.
   *
   * @param topic the topic to unsubscribe from
   * @param handler the event handler
   *
   * @return true if a handler was removed
   */
  unsubscribe(topic: string, handler?: EventHandler): boolean {
    if (!handler) {
      return this.c.delete(topic);
    }

    const topics = this.c.get(topic);
    if (!topics) {
      return false;
    }

    // We need to find and remove a specific handler
    const index = topics.indexOf(handler);

    if (index < 0) {
      // Wasn't found, wasn't removed
      return false;
    }
    topics.splice(index, 1);
    if (topics.length === 0) {
      this.c.delete(topic);
    }
    return true;
  }

  /**
   * Publish an event to the given topic.
   *
   * @param topic the topic to publish to
   * @param eventData the data to send as the event
   */
  publish(topic: string, ...args: any[]) {  //: any[] | null {
    const topics = this.c.get(topic);
    if (!topics) {
      return null;
    }
    // return topics.map(handler => {
    //   try {
    //     return handler(...args);
    //   } catch (e) {
    //     console.error(e);
    //     return null;
    //   }
    // });
    topics.map(handler => {
        setTimeout( () => {
            handler(...args);
        }, 0);
      });
    }
}

/**
 * A custom Events service just like Ionic 3 Events https://ionicframework.com/docs/v3/api/util/Events/ which got removed in Ionic 5.
 *
 * @author Shashank Agrawal
 */
// @Injectable({
//     providedIn: 'root'
// })
// export class Events {

//     private channels: { [key: string]: Subject<any>; } = {};
//     private observers = new WeakMap();

//     /**
//      * Subscribe to a topic and provide a single handler/observer.
//      * @param topic The name of the topic to subscribe to.
//      * @param observer The observer or callback function to listen when changes are published.
//      *
//      * @returns Subscription from which you can unsubscribe to release memory resources and to prevent memory leak.
//      */
//     subscribe(topic: string, observer: (_: any) => void): Subscription {
//         if (!this.channels[topic]) {
//             this.channels[topic] = new Subject<any>();
//         }
//         var ss = this.channels[topic].subscribe(observer);
//         this.observers.set(observer, ss);

//         return ss;
//     }

//     /**
//      * Unsubscribe using the observer
//      * - for compatibility with Events obsoleted in ionic v5
//      * @param topic The name of the topic to emit data to.
//      * @param observer The key to look up the subscription
//      */
//     unsubscribe(topic: string, observer: (_: any) => void) {
//         var ss = this.observers.get(observer);
//         if( ss )
//         {
//             ss.unsubscribe();
//             this.observers.delete(ss);    
//         }
//     }

//     /**
//      * Publish some data to the subscribers of the given topic.
//      * @param topic The name of the topic to emit data to.
//      * @param data data in any format to pass on.
//      */
//     publish(topic: string, data: any): void {
//         const subject = this.channels[topic];
//         if (!subject) {
//             // Or you can create a new subject for future subscribers
//             return;
//         }
//         console.log(topic,"[" + data.name + ']');
//         subject.next(data);
//     }

//     /**
//      * When you are sure that you are done with the topic and the subscribers no longer needs to listen to a particular topic, you can
//      * destroy the observable of the topic using this method.
//      * @param topic The name of the topic to destroy.
//      */
//     destroy(topic: string): null {
//         const subject = this.channels[topic];
//         if (!subject) {
//             return;
//         }

//         subject.complete();
//         delete this.channels[topic];
//     }
// }