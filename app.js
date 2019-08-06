const express = require('express');
const request = require('request');
const mysql = request('mysql');
var nodemailer = require('nodemailer');

const service_email = "danik1991.dk@gmail.com";
const service_pass = "danik1991";

const port = process.env.PORT || 3001;

const app = express();

app.get('/getAccessKey', (req, res, next)=>{
    var accessKey = req.query.key;
    var employee_email = req.query.user_email;
    var employee_access_password = req.query.pass;

    var url = `https://dbrainz-flora-server-app.herokuapp.com/getUserData?e=${employee_email}&p=${employee_access_password}`;

    request(url, (error, response, body)=>{
        if(!error && response.statusCode === 200){
          var results = JSON.stringify(body);
          if(results.length == 0)
            res.send({
                error: "user not found"
            });
          else{
              if(results[0].user_priv != '5')
                res.send({
                    error: "user does not have access to medical data"
                });
              else{
                sendAccessKey(employee_email);
                res.send({
                    status: "OK",
                    access: "email with access key was sent to employee email",
                    access_key_timeout: "you access key will be valid for 1 hour"
                });
              }
          }
        }
        else
          throw error;
    });
})

app.get('/getMedicalData', (req, res, next)=>{
    var accessKey = req.query.key;
    var employee_email = req.query.user_email;
    var data_request_id = req.query.medical_id;
    var employee_access_password = req.query.pass;


    var sql = `SELECT * FROM temp_user_access WHERE access_email='${employee_email}' AND access_pass='${employee_access_password}' AND key=${accessKey}`;
        mysql.query(sql, function (error, result, fields) {
            if (error)
                throw error;
            else{
                if(result.length == 0){
                    res.send({
                        error: "access key is invalid / access entry not found"
                    });
                }
                else{
                    mysql.query(`SELECT * FROM medical_data WHERE id=${data_request_id}`, function(error, result,fields){
                        if(error)
                          throw error;
                        else{
                            res.send(JSON.stringify(result));
                        }
                    })
                }
            }
        });


})

function sendAccessKey(employee_email, employee_access_password){
    var accessKey = makeAccessKey(24);
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: service_email,
          pass: service_pass
        }
      });
    var mailOptions = {
        from: service_email,
        to: employee_email,
        subject: 'Medical Data Access Key',
        text: `Your medical access key is:  ${accessKey}\n\nAfter 1 hour this key will be invalid.`
    };
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
          var sql = `INSERT INTO temp_user_access (access_email, access_password, key, ttl)
          VALUES(${employee_email}, ${employee_access_password}, ${accessKey}, 3600)`;
          mysql.query(sql, function(error, result, fields){
              if(error)
                throw error;
              else
                console.log("temporary user created");
          })
          setTimeout(function(){
              var sql = `DELETE FROM temp_user_access WHERE key = ${accessKey}`;
              mysql.query(sql, function(error, result, fields){
                  if(error)
                    throw error;
                  else
                    console.log(`key ${accessKey} is dead`);
                    
              })
          },10000); // 8 sec
        }
    });


}

function makeAccessKey(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   console.log(`key : ${result} has been generated`);
   
   return result;
}

app.listen(port);
