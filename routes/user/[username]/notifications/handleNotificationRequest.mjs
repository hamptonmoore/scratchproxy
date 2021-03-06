/*
    Shared handler function for /users/:username/notifications/ and /users/:username/notifications/alt

*/

import express from "express";
import { User } from "../../../../modules/db.mjs";
import queue from "../../../../modules/queue.mjs";
import {
    QUEUE_ITEMS_PER_SECOND,
    EHHH_ITEMS_PER_SECOND,
} from "../../../../modules/consts.mjs";

export default async function handleNotificationRequest(res, username, queueType) {

    if (username == "46009361"){
        res.json({
            count: new Date().getTime(),
            timeout: 250,
        })
        return;
    }

    User.findOrCreate({
        where: { username: username },
        defaults: {
            username: username,
        },
    }).then(([user, created]) => {
        user.lastKeepAlive = new Date().valueOf();
        user.save();

        let queuePosition = queueType.findIndex(
            (item) => item.data.username === username
        );

        if (queuePosition === -1) {
            // Lets see if we have any cached message count
            if (created || user.messages === -1) {
                // If not lets make a notification queue where we put them in the front of the line
                queue
                    .add(
                        queue.TYPES.Notifications,
                        {
                            username: username,
                        },
                        queue.queues.asap
                    )
                    .then((messageCount) => {
                        res.send({
                            count: messageCount,
                            timeout: 5000, // Just wait a bit ok?
                            firstTime: true,
                        });
                    })
                    .catch((err) => {
                        console.log(err);
                    });
                return;
            }

            // Otherwise lets do a normal notification

            queue.add(
                queue.TYPES.Notifications,
                {
                    username: username,
                },
                queueType
            );

            queuePosition = queueType.length;
        }
        let timeout = 1500;

        if (queueType === queue.queues.ehhh) {
            timeout += queuePosition * (1000 / EHHH_ITEMS_PER_SECOND);
        } else if (queueType === queue.queues.idrc) {
            timeout +=
                queue.queues.ehhh.length * (1000 / EHHH_ITEMS_PER_SECOND);
            timeout +=
                queuePosition *
                (1000 / (QUEUE_ITEMS_PER_SECOND - EHHH_ITEMS_PER_SECOND));
        }

        res.json({
            count: user.messages,
            timeout: timeout,
        });
    });
};