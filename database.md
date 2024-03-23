# v1.0 #

------------
AWS DynamoDB
------------


-------------------
Create table - Auth
-------------------
Session data of an Actor

* Table Name: session_actor
* Partition Key: p [string]
* Sort Key: sid [string]

* Secondary Index: [NONE]
* Read/write capacity mode: On-demand

* After Table is Created-
* Overview -> Table details -> Time to live attribute -> Manage TTL
    * Time to live attribute: toe

Table Structure
---------------
* p (String)        -> [Partition Key] Brand ID (Customers belongs to a brand)
* sid (String)      -> [Sort Key] Session Owner's Actor-ID + '.' + Token-Key + '.' + Token-Secret-Hash
* pc (Number)       -> Session Platform Code - 0:WEBAPP, 1:IOS, 2:ANDROID (Same as Site-Type Code)
* toc (Number)      -> Session Time of Creation
* toe (Number)      -> Session Time of Expiration (null means never expire)
* tola (Number)     -> Session Time of Last Accessed (In Period of 24 hours) (null means no last accessed tracking)
* aid (String)      -> Customer-ID (Actor-ID) to whom this session belongs to
* stid (String)     -> Site-ID on which this session exists. Each instance of client app is new site (Future use for Notifications)
* cl_w (String)     -> Client Screen Width
* cl_h (String)     -> Client Screen Height
* cl_n (String)     -> Client Name
* cl_v (String)     -> Client Version
* cl_ib (String)    -> Client Is Browser
* cl_os (String)    -> Client OS Name
* cl_osv (String)   -> Client OS-Version
* cl_ip (String)    -> Client IP-Address
