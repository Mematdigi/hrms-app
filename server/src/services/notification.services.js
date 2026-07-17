// /*
//  * Copper Digital Inc
//  * Copyright (c) 2023-Present Copper Digital
//  * Contact at copper digital dot com
//  */
// const moment = require('moment');
// const emailService = require('./email.services');
// const config = require('../config/config');
// let ejs = require('ejs');
// const ApiError = require('../utils/apiError');
// const { Op } = require('sequelize');
// const { crud } = require('../utils/messageHandler');
// const { UserModel, NotificationModel } = require('../model');

// class NotificationService {

//   /*
//    * This method checks for User's Optional SMS or Email settings
//    */
//   canSendNotificaiton(notificationItem, type) {
//     // type 1 email, 2 sms, 3 in-app
//     const reciever = notificationItem.data.reciever;
//     const isRecieverProvider = reciever.app_id === 1;
//     const notificationConfig = notificationItem.config;

//     // Case Email
//     if (type === 1) {

//       if (!notificationConfig.email) {
//         return false;
//       }

//       if (notificationConfig.isMandatory) {
//         return true;
//       }

//       return true;
//     }

//     // Case SMS
//     if (type === 2) {
//       if (!notificationConfig.sms) {
//         return false;
//       }

//       if (notificationConfig.isMandatory) {
//         return true;
//       }

//       return false;
//     }

//     if (type === 3) {
//       if (!notificationConfig.inApp) {
//         return false;
//       }
//     }
//   }

//   async sendPush(data) {
//     let queryOptions, responseData;

//     queryOptions = {
//       id: data.reciever.id,
//       device_token: { $ne: null },
//     };

//     responseData = await UserModel.find(queryOptions);

//     if (!responseData?.length) {
//       return false;
//     }

//     const tokens = responseData.map((item) => item.device_token);

//     const message = {
//       notification: {
//         title: data.title,
//         body: data.message,
//       },
//       data: {
//         //data
//       },
//       tokens: tokens,
//     };

//     const messaging = firebaseAdmin.messaging();

//     messaging
//       .sendMulticast(message)
//       .then((result) => {
//         this.removeStaleTokens(result, tokens);
//       })
//       .catch((error) => {
//         throw new ApiError(statusCodes.INTERNAL_SERVER_ERROR, crud('Firebase message', 'c', false));
//       });
//   }

//   async sendNotifications(notificationData, dbTxn) {
//     let queryOptions, requestBody, title, description;

//     for (let notificationItem of notificationData) {
//       const reciever = notificationItem.data.reciever;
//       const notificationConfig = notificationItem.config;
//       const templateVars = notificationItem.data.templateVars;

//       // In-App notification required
//       if (notificationConfig.inApp) {
//         title = ejs.render(notificationConfig.inApp.title, templateVars);
//         description = ejs.render(notificationConfig.inApp.message, templateVars);
//         queryOptions = {};
//         requestBody = {
//           type: notificationConfig.type,
//           user_id: reciever.id,
//           created_by: notificationItem.data.createdBy,
//           title,
//           description,
//         };

//         if (dbTxn) {
//           queryOptions.transaction = dbTxn;
//         }

//         await NotificationModel(requestBody).save();

//         // check if push required
//         if (notificationConfig.isPush) {
//           await this.sendPush({ reciever, title, message });
//         }
//       }
//       // --------- Block Ends Here --------- //

//       // Check and Send Email
//       if (this.canSendNotificaiton(notificationItem, 1) && reciever.email) {
//         await emailService.sendEmail({
//           to: reciever.email,
//           from: config.email.from,
//           subject: notificationConfig.email.subject,
//           template: notificationConfig.email.tpl,
//           templateVars: templateVars,
//         });
//       }
//       // --------- Block Ends Here --------- //

//       // Check and Send SMS
//       if (this.canSendNotificaiton(notificationItem, 2)) {
//         await twilioService.sendSms(reciever.mobile_number, ejs.render(notificationConfig.sms.message, templateVars));
//       }
//       // --------- Block Ends Here --------- //
//     }
//   }
// }
// module.exports = new NotificationService();