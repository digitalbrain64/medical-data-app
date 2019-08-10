const express = require('express');
const request = require('request');
const mysql = require('mysql');
var nodemailer = require('nodemailer');

var mySqlConnString = "mysql://bd60400816cf64:804ba615@us-cdbr-iron-east-02.cleardb.net/heroku_9a8e608802085ff?reconnect=true";

const mySqlPool = mysql.createPool("mysql://bd60400816cf64:804ba615@us-cdbr-iron-east-02.cleardb.net/heroku_9a8e608802085ff?reconnect=true");
const service_email = "globalsostracker@mail.ru";
const service_pass = "kogan15011991";

const port = process.env.PORT || 3001;

const app = express();

var medicalRecord = null;

app.get('/getAccessKey', (req, res, next)=>{
    //var accessKey = req.query.key;
    var employee_email = req.query.e;
    var employee_access_password = req.query.p;

    var url = `https://dbrainz-flora-server-app.herokuapp.com/getUserData?e=${employee_email}&p=${employee_access_password}`;

    request(url, (error, response, body)=>{
        if(!error && response.statusCode === 200){
          var results = JSON.parse(body);
          if(results.length == 0)
            res.send({
                error: "user not found"
            });
          else{
              console.log(results[0]);
              
              if(results.user_priv != 5)
                res.send({
                    error: "user does not have access to medical data"
                });
              else{
                if(sendAccessKey(employee_email,employee_access_password));
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
    var accessKey = req.query.k;
    var employee_email = req.query.e;
    var data_request_id = req.query.mi;
    var employee_access_password = req.query.p;


    var sql = `SELECT * FROM temp_user_access WHERE access_email='${employee_email}' AND access_pass='${employee_access_password}' AND access_key='${accessKey}'`;
    mySqlPool.query(sql, function (error, result, fields) {
        if (error)
            throw error;
        else{
            if(result.length == 0){
                res.send({
                    error: "access key is invalid / bad access"
                });
            }
            else{
                getMedicalRecord(function(err, data){
                    if(err)
                      res.send({error: 'database error'})
                    else{
                        // var ids = data.patient_contacts.split(',');
                        // for(var i = 0; i<ids.length; i++){
                        //     getContacts(function(error, data){
                        //         if(error)
                        //             console.log(error);
                                  
                        //         else{
                        //             console.log(data);
                                    
                        //         }
                        //     },ids[i])
                        // }
                        res.send(data);
                        
                    }
                      
                    
                },data_request_id)
                
            }
        }
    })
})

function getContacts(callback, contacts_id){
    mySqlPool.query(`SELECT * FROM patients_contact_data WHERE contact_id=${contacts_id}`, function(error, result, fields){
        if(error)
          throw error
        else{
            callback(error, result);
        }
    })
}

function getMedicalRecord(callback, medical_id){
    mySqlPool.query(`SELECT * FROM patient_general_data WHERE patient_id=${medical_id}`, function(error, result,fields){
        if(error)
            throw error;
        else{
            if(result.length == 0)
                callback(error, {err: 'medical record not found'});
                
            else{
                callback(error, result[0])
            }
        }
    })
}

function sendAccessKey(employee_email, employee_access_password){
    
    var accessKey = makeAccessKey(24);
    console.log(`Email: ${employee_email}, pass: ${employee_access_password}, key: ${accessKey}`);

    var transporter = nodemailer.createTransport({
        service: 'mail.ru',
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
          var sql = `INSERT INTO temp_user_access (access_key, access_email, access_pass) VALUES ("${accessKey}", "${employee_email}", "${employee_access_password}");`;
          mySqlPool.query(sql, function(error, result, fields){
              if(error){
                throw error;
              }
              else
                console.log("temporary user created");
          })
          setTimeout(function(){
              var sql = `DELETE FROM temp_user_access WHERE access_key = '${accessKey}'`;
              mySqlPool.query(sql, function(error, result, fields){
                  if(error)
                    throw error;
                  else
                    console.log(`key ${accessKey} is dead`);
                    
              })
          },3600000); // 1 hour
        }
    });

    return true;


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
