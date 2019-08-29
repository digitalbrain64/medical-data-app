const express = require('express');
const request = require('request');
const mysql = require('mysql');
var nodemailer = require('nodemailer');

const mySqlPool = mysql.createPool("mysql://bd60400816cf64:804ba615@us-cdbr-iron-east-02.cleardb.net/heroku_9a8e608802085ff?reconnect=true");
const service_email = "globalsostracker@mail.ru";
const service_pass = "kogan15011991";

const port = process.env.PORT || 3001;

const app = express();

app.get('/getAccessKey', (req, res, next)=>{
    //var accessKey = req.query.key;
    if(!req.query.e && !req.query.p){
        res.send([{
            status: "error",
            message: "please provide email and password"
        }])
    }
    else{

    
    var employee_email = req.query.e;
    var employee_access_password = req.query.p;
    var url = `https://dbrainz-flora-server-app.herokuapp.com/getUserData?u=${employee_email}&p=${employee_access_password}`;

    request(url, (error, response, body)=>{
        if(!error && response.statusCode === 200){
          var results = JSON.parse(body);
          if(results.length == 0)
            res.send([{
                error: "user not found"
            }]);
          else{
              console.log(results[0]);
              
              if(results[0].user_priv != 5)
                res.send({
                    error: "user does not have access to medical data"
                });
              else{
                if(sendAccessKey(employee_email,employee_access_password));
                    res.send([{
                        status: "OK",
                        access: "email with access key was sent to employee email",
                        access_key_timeout: "you access key will be valid for 1 hour"
                    }]);
              }
          }
        }
        else
          throw error;
    });
}
})

app.get('/getMedicalData', (req, res, next)=>{
    if(!req.query.key || !req.query.e || !req.query.user_id){
        res.send([{
            status : "error",
            message : "missing credential"
        }])
    }
    var accessKey = req.query.key;
    var employee_email = req.query.e;
    var data_request_id = req.query.user_id;
    var employee_access_password = req.query.p;

    var medicalRecord = [];

    var basic_data = null;
    var patient_contacts = [];
    var patient_conditions = null;
    var patient_personal_doctors = null;
    var patient_notes = null;
    var patient_prescriptions = null;
    
    var database = new Database("mysql://bd60400816cf64:804ba615@us-cdbr-iron-east-02.cleardb.net/heroku_9a8e608802085ff?reconnect=true");

    var sql = `SELECT * FROM temp_user_access WHERE access_email='${employee_email}' AND access_pass='${employee_access_password}' AND access_key='${accessKey}'`;
    mySqlPool.query(sql, function (error, result, fields) {
        if (error)
            throw error;
        else{
            if(result.length == 0){
                res.send([{
                    error: "access key is invalid / bad access"
                }]);
            }
            else{
                database.query( `SELECT * FROM patient_general_data WHERE patient_id='${data_request_id}'` )
                .then( rows => {
                    basic_data = rows;
                    return database.query( `SELECT * FROM patient_prescriptions WHERE patient_id='${data_request_id}'` );
                })
                .then( rows => {
                    patient_prescriptions = rows;
                    return database.query( `SELECT patient_contact_relation.relation ,contacts.contact_first_name, contacts.contact_last_name, contacts.contact_address, contacts.contact_phone_number_1, contacts.contact_phone_number_2
                    FROM contacts
                    LEFT JOIN patient_contact_relation
                    ON patient_contact_relation.contact_id=contacts.contact_id
                    WHERE patient_contact_relation.patient_id = ${data_request_id};` );
                } )
                .then( rows => {
                    patient_contacts = rows;
                    return database.query( `SELECT doctors.doctor_first_name, doctors.doctor_last_name, doctors.doctor_office_address,patient_personal_doctors.personal_from_date,patient_personal_doctors.usual_visit_address , doctors.doctor_contact_number_1, doctors.doctor_contact_number_2
                    FROM doctors
                    LEFT JOIN patient_personal_doctors
                    ON patient_personal_doctors.doctor_id=doctors.doctor_id
                    WHERE patient_personal_doctors.patient_id = ${data_request_id};` );
                } )
                .then ( rows =>{
                    patient_personal_doctors = rows;
                    return database.query(`SELECT patient_prescriptions.prescription_date,medicines.med_name, medicines.med_porpuse, medicines.active_chemicals,medicines.med_volume,patient_prescriptions.use_schedule
                    FROM medicines
                    LEFT JOIN patient_prescriptions
                    ON patient_prescriptions.med_id=medicines.med_id
                    WHERE patient_prescriptions.patient_id = ${data_request_id};`);
                })
                .then( rows =>{
                    patient_prescriptions = rows;
                    return database.query(`SELECT patient_medical_notes.note_date,patient_medical_notes.note_description,doctors.doctor_first_name,doctors.doctor_last_name
                    FROM doctors
                    LEFT JOIN patient_medical_notes
                    ON patient_medical_notes.doctor_id=doctors.doctor_id
                    WHERE patient_medical_notes.patient_id = ${data_request_id};`);
                })
                .then(rows =>{
                    patient_notes = rows;
                    return database.query(`SELECT patient_conditions.condition_from_date,patient_conditions.condition_to_date,doctors.doctor_first_name,doctors.doctor_last_name,patient_conditions.condition_description, patient_conditions.high_pulse_related
                    FROM doctors
                    LEFT JOIN patient_conditions
                    ON patient_conditions.diagnosed_by=doctors.doctor_id
                    WHERE patient_conditions.patient_id = ${data_request_id};`);
                },err => {
                    return database.close().then( () => { throw err; } )
                })
                .then(rows =>{
                    patient_conditions = rows;
                    return database.close();
                })
                .then( () => {
                    medicalRecord = [{
                        patient_id : basic_data[0].patient_id,
                        patient_first_name : basic_data[0].patient_first_name,
                        patient_last_name : basic_data[0].patient_last_name,
                        patient_birthday : basic_data[0].patient_birthday,
                        patient_weight : basic_data[0].patient_weight,
                        patient_height : basic_data[0].patient_height,
                        patient_gender : basic_data[0].patient_gender,
                        patient_home_address : basic_data[0].patient_address,
                        patient_contact_number_1 : basic_data[0].patient_phone_number_1,
                        patient_contact_number_2 : basic_data[0].patient_phone_number_2,
                        patient_contacts : patient_contacts,
                        patient_personal_doctors : patient_personal_doctors,
                        patient_med_prescriptions : patient_prescriptions,
                        patient_medical_notes : patient_notes,
                        patient_health_conditions : patient_conditions
                    }]
                    res.send([medicalRecord[0]]);
                } )
                .catch( err => {
                    if(basic_data.length == 0){
                        res.send([{
                            database_error: `no medical data found for patient : ${data_request_id}`
                        }]);
                    }
                    else{
                        res.send([{
                            database_error: err
                        }])
                    }
                    
                } );
            }
        }
    })
})

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

class Database {
    constructor(config) {
        this.connection = mysql.createConnection( config );
    }
    query( sql, args ) {
        return new Promise( ( resolve, reject ) => {
            this.connection.query( sql, args, ( err, rows ) => {
                if ( err )
                    return reject( err );
                resolve( rows );
            } );
        } );
    }
    close() {
        return new Promise( ( resolve, reject ) => {
            this.connection.end( err => {
                if ( err )
                    return reject( err );
                resolve();
            } );
        } );
    }
}

app.listen(port, ()=>{
    console.log(`listening on port ${port}`);
    
});
