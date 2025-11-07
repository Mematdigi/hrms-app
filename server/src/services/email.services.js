// /*
//  * Copper Digital Inc
//  * Copyright (c) 2023-Present Copper Digital
//  * Contact at copper digital dot com
//  */

// const nodemailer = require('nodemailer');
// const config = require('../config/config');
// const logger = require('../config/logger');
// const fs = require('fs');
// const ejs = require('ejs');
// const { htmlToText } = require('html-to-text');
// const juice = require('juice');
// const path = require('path');

// const transport = nodemailer.createTransport(config.email.smtp);

// // Verify
// transport
//   .verify()
//   .then(() => logger.info('Connected to email server'))
//   .catch(() => logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env'));

// const sendEmail = async ({ template: templateName, templateVars, ...restOfOptions }) => {
//   const templatePath = `${path.join(__dirname, '../utils/templates/')}${templateName}.html`;
//   const options = {
//     ...restOfOptions,
//   };

//   if (templateName && fs.existsSync(templatePath)) {
//     const template = fs.readFileSync(templatePath, 'utf-8');
//     const html = ejs.render(template, templateVars);
//     const text = htmlToText(html);
//     const htmlWithStylesInlined = juice(html);

//     options.html = htmlWithStylesInlined;
//     options.text = text;
//   }

//   return transport.sendMail(options);
// };

// module.exports = {
//   sendEmail,
// };
