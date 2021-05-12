/**
*
*
*	@Patrik Dragan
*
*
*
**/

module.exports = function(RED) {
    "use strict";
    var os = require('os');
    var dgram = require('dgram');
	var net = require('net');
    var someipInputPortsInUse = {};

    // The Input Node
    function someipin(n) {
        RED.nodes.createNode(this,n);
        this.group = n.group;
        this.port = n.port;
        this.datatype = n.datatype;
        this.iface = n.iface || null;
        this.multicast = n.multicast;
        this.ipv = n.ipv || "udp4";
        var node = this;

        if (node.iface && node.iface.indexOf(".") === -1) {
            try {
                if ((os.networkInterfaces())[node.iface][0].hasOwnProperty("scopeid")) {
                    if (node.ipv === "udp4") {
                        node.iface = (os.networkInterfaces())[node.iface][1].address;
                    } else {
                        node.iface = (os.networkInterfaces())[node.iface][0].address;
                    }
                }
                else {
                    if (node.ipv === "udp4") {
                        node.iface = (os.networkInterfaces())[node.iface][0].address;
                    } else {
                        node.iface = (os.networkInterfaces())[node.iface][1].address;
                    }
                }
            }
            catch(e) {
                node.warn(RED._("someip: interface __iface__ not found",{iface:node.iface}));
                node.iface = null;
            }
        }

        if(node.ipv == "udp4"){
			var opts = {type:'udp4', reuseAddr:true};
		} else {
			var opts = {type:'udp6', reuseAddr:true};
		}
        if (process.version.indexOf("v0.10") === 0) { opts = node.ipv; }
        var server;
        if (!someipInputPortsInUse.hasOwnProperty(node.port)) {
            server = dgram.createSocket(opts);  // default to udp4 socker
            server.bind(node.port, function() {
                if (node.multicast == "true") {
                    server.setBroadcast(true);
                    server.setMulticastLoopback(false);
                    try {
                        server.setMulticastTTL(128);
                        server.addMembership(node.group,node.iface);
                        if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
                        node.log(RED._("someip multicast group __group__",{group:node.group}));
                    } catch (e) {
                        if (e.errno == "EINVAL") {
                            node.error(RED._("Bad Multicast Address"));
                        } else if (e.errno == "ENODEV") {
                            node.error(RED._("Must be ip address of the required interface"));
                        } else {
                            node.error(RED._("error: __error__",{error:e.errno}));
                        }
                    }
                }
            });
            someipInputPortsInUse[node.port] = server;
        }
        else {
            node.log(RED._("someip: port __port__ already in use",{port:node.port}));
            server = someipInputPortsInUse[node.port];  // re-use existing
            if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
        }

        server.on("error", function (err) {
            if ((err.code == "EACCES") && (node.port < 1024)) {
                node.error(RED._("someip access error, you may need root access for ports below 1024"));
            } else {
                node.error(RED._("error: __error__",{error:err.code}));
            }
            server.close();
        });

        server.on('message', function (message, remote) {
            var msg;
            if (node.datatype =="base64") {
                msg = { payload:message.toString('base64'), fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
            } else if (node.datatype =="utf8") {
                msg = { payload:message.toString('utf8'), fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
            } else {
                msg = { payload:message, fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
            }
            node.send(msg);
        });

        server.on('listening', function () {
            var address = server.address();
			// node.log(RED._("someip listener at"));
            node.log(RED._("someip listener at __host__:__port__",{host:node.iface||address.address,port:address.port}));
        });

        node.on("close", function() {
            try {
                if (node.multicast == "true") { server.dropMembership(node.group); }
                server.close();
                node.log(RED._("someip listener stopped"));
            } catch (err) {
                //node.error(err);
				node.error(RED._("error: __error__",{error:e.errno}));
            }
            if (someipInputPortsInUse.hasOwnProperty(node.port)) {
                delete someipInputPortsInUse[node.port];
            }
            node.status({});
        });

    }
    RED.httpAdmin.get('/someip-ports/:id', RED.auth.needsPermission('someip-ports.read'), function(req,res) {
        res.json(Object.keys(someipInputPortsInUse));
    });
    RED.nodes.registerType("someip in",someipin);



    // The Output Node
    function someipout(n) {
        RED.nodes.createNode(this,n);
        //this.group = n.group;
		this.messageid = n.messageid;
		//this.length = n.length;
		this.requestid = n.requestid;
		//this.protV = n.protV;
		//this.interfV = n.interfV;
		//this.msgType = n.msgType;
		//this.rtnCode = n.rtnCode;
        this.port = n.port;
        this.outport = n.outport||"";
        this.base64 = n.base64;
        this.addr = n.addr;
        this.iface = n.iface || null;
        this.multicast = n.multicast;
        this.ipv = n.ipv || 'udp4';
        var node = this;
	
        if (node.iface && node.iface.indexOf(".") === -1) {
            try {
                if ((os.networkInterfaces())[node.iface][0].hasOwnProperty("scopeid")) {
                    if (node.ipv === "udp4") {
                        node.iface = (os.networkInterfaces())[node.iface][1].address;
                    } else {
                        node.iface = (os.networkInterfaces())[node.iface][0].address;
                    }
                }
                else {
                    if (node.ipv === "udp4") {
                        node.iface = (os.networkInterfaces())[node.iface][0].address;
                    } else {
                        node.iface = (os.networkInterfaces())[node.iface][1].address;
                    }
                }
            }
            catch(e) {
                node.warn(RED._("someip: interface __iface__ not found",{iface:node.iface}));
                node.iface = null;
            }
        }
		if(node.ipv == "udp4"){
			var opts = {type:'udp4', reuseAddr:true};
		} else {
			var opts = {type:'udp6', reuseAddr:true};
		}

        var sock;
        var p = this.outport || this.port || "0";
        node.tout = setTimeout(function() {
            if (someipInputPortsInUse[p]) {
                sock = someipInputPortsInUse[p];
                if (node.multicast != "false") {
                    sock.setBroadcast(true);
                    sock.setMulticastLoopback(false);
                }
                node.log(RED._("someip re-use socket: __outport__ -> __host__:__port__",{outport:node.outport,host:node.addr,port:node.port}));
                if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
            }
            else {
                sock = dgram.createSocket(opts);  // default to someip4
                if (node.multicast != "false") {
                    sock.bind(node.outport, function() {    // have to bind before you can enable broadcast...
                        sock.setBroadcast(true);            // turn on broadcast
                        sock.setMulticastLoopback(false);   // turn off loopback
                        if (node.multicast == "multi") {
                            try {
                                sock.setMulticastTTL(128);
                                sock.addMembership(node.addr,node.iface);   // Add to the multicast group
                                if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
                                node.log(RED._("someip multicast ready: __iface__:__outport__ -> __host__:__port__",{iface:node.iface,outport:node.outport,host:node.addr,port:node.port}));
                            } catch (e) {
								if (e.errno == "EINVAL") {
									node.error(RED._("Bad Multicast Address"));
								} else if (e.errno == "ENODEV") {
									node.error(RED._("Must be ip address of the required interface"));
								} else {
									node.error(RED._("error: __error__",{error:e.errno}));
								}
                            }
                        } else {
                            node.log(RED._("someip broadcast ready: __outport__ -> __host__:__port__",{outport:node.outport,host:node.addr,port:node.port}));
                        }
                    });
                } else if ((node.outport !== "") && (!someipInputPortsInUse[node.outport])) {
                    sock.bind(node.outport);
                    node.log(RED._("someip ready: __outport__ -> __host__:__port__",{outport:node.outport,host:node.addr,port:node.port}));
                } else {
                    node.log(RED._("someip ready: __host__:__port__",{host:node.addr,port:node.port}));
                }
                sock.on("error", function(err) {
                    // Any async error will also get reported in the sock.send call.
                    // This handler is needed to ensure the error marked as handled to
                    // prevent it going to the global error handler and shutting node-red
                    // down.
                });
                someipInputPortsInUse[p] = sock;
            }

            node.on("input", function(msg, nodeSend, nodeDone) {
                if (msg.hasOwnProperty("payload")) {
                    var add = node.addr || msg.ip || "";
                    var por = node.port || msg.port || 0;
					var messageid = node.messageid || "0";
					var requestid = node.requestid || "0";
                    if (add === "") {
                        node.warn(RED._("someip: ip address not set"));
                        nodeDone();
                    } else if (por === 0) {
                        node.warn(RED._("someip: port not set"));
                        nodeDone();
                    } else if (isNaN(por) || (por < 1) || (por > 65535)) {
                        node.warn(RED._("someip: port number not valid"));
                        nodeDone();
                    } else {
                        var message;
						var tmp;
						var length;
						var protV = 0;
						var interfV = 1;
						var msgType = 2;
						var rtnCode = 0;
                        if (node.base64) {
                            tmp = Buffer.from(msg.payload, 'base64');
							length = tmp.length;
							message = messageid + length + requestid + protV + interfV + msgType + rtnCode + tmp;
                        } else if (msg.payload instanceof Buffer) {
                            tmp = msg.payload;
							length = tmp.length;
							message = messageid + length + requestid + protV + interfV + msgType + rtnCode + tmp;
                        } else {
                            tmp = Buffer.from(""+msg.payload);
							length = tmp.length;
							message = messageid + length + requestid + protV + interfV + msgType + rtnCode + tmp;
                        }
                        sock.send(message, 0, message.length, por, add, function(err, bytes) {
                            if (err) {
                                node.error("someip : "+err,msg);
                            }
                            message = null;
                            nodeDone();
                        });
                    }
                }
            });
        }, 75);

        node.on("close", function() {
            if (node.tout) { clearTimeout(node.tout); }
            try {
                if (node.multicast == "multi") { sock.dropMembership(node.group); }
                sock.close();
                node.log(RED._("someip output stopped"));
            } catch (err) {
                //node.error(err);
				node.error(RED._("error: __error__",{error:e.errno}));
            }
            if (someipInputPortsInUse.hasOwnProperty(p)) {
                delete someipInputPortsInUse[p];
            }
            node.status({});
        });
    }
    RED.nodes.registerType("someip out",someipout);
}
