/*

Jappix - An open social platform
These are the CAPS JS script for Jappix

-------------------------------------------------

License: AGPL
Author: Valérian Saliou, Maranda

*/

// Bundle
var Caps = (function () {

    /**
     * Alias of this
     * @private
     */
    var self = {};


	/**
     * Returns an array of the Jappix disco#infos
     * @public
     * @return {object}
     */
    self.myDiscoInfos = function() {

        try {
            var disco_base = [
                NS_MUC,
                NS_MUC_USER,
                NS_MUC_ADMIN,
                NS_MUC_OWNER,
                NS_MUC_CONFIG,
                NS_DISCO_INFO,
                NS_DISCO_ITEMS,
                NS_PUBSUB_RI,
                NS_BOSH,
                NS_CAPS,
                NS_MOOD,
                NS_ACTIVITY,
                NS_TUNE,
                NS_GEOLOC,
                NS_NICK,
                NS_URN_ADATA,
                NS_URN_AMETA,
                NS_URN_MBLOG,
                NS_URN_INBOX,
                NS_MOOD + NS_NOTIFY,
                NS_ACTIVITY + NS_NOTIFY,
                NS_TUNE + NS_NOTIFY,
                NS_GEOLOC + NS_NOTIFY,
                NS_URN_MBLOG + NS_NOTIFY,
                NS_URN_INBOX + NS_NOTIFY,
                NS_URN_DELAY,
                NS_ROSTER,
                NS_ROSTERX,
                NS_HTTP_AUTH,
                NS_CHATSTATES,
                NS_XHTML_IM,
                NS_URN_MAM,
                NS_IPV6,
                NS_LAST,
                NS_PRIVATE,
                NS_REGISTER,
                NS_SEARCH,
                NS_COMMANDS,
                NS_VERSION,
                NS_XDATA,
                NS_VCARD,
                NS_URN_TIME,
                NS_URN_PING,
                NS_URN_RECEIPTS,
                NS_PRIVACY,
                NS_IQOOB,
                NS_XOOB
            ];

            var disco_jingle = JSJaCJingle_disco();
            var disco_all = disco_base.concat(disco_jingle);
            
            return disco_all;
        } catch(e) {
            Console.error('Caps.myDiscoInfos', e);
        }

    };


    /**
     * Gets the disco#infos of an entity
     * @public
     * @param {string} to
     * @param {string} caps
     * @return {boolean}
     */
    self.getDiscoInfos = function(to, caps) {

        try {
            // No CAPS
            if(!caps) {
                Console.warn('No CAPS: ' + to);
                
                displayDiscoInfos(to, '');
                
                return false;
            }
            
            // Get the stored disco infos
            var xml = XMLFromString(getPersistent('global', 'caps', caps));
            
            // Yet stored
            if(xml) {
                Console.info('CAPS from cache: ' + to);
                
                displayDiscoInfos(to, xml);
                
                return true;
            }
            
            Console.info('CAPS from the network: ' + to);
            
            // Not stored: get the disco#infos
            var iq = new JSJaCIQ();
            
            iq.setTo(to);
            iq.setType('get');
            iq.setQuery(NS_DISCO_INFO);
            
            con.send(iq, handleDiscoInfos);
            
            return true;
        } catch(e) {
            Console.error('Caps.getDiscoInfos', e);
        }

    };


    /**
     * Handles the disco#infos of an entity
     * @public
     * @param {object} iq
     * @return {undefined}
     */
    self.handleDiscoInfos = function(iq) {

        try {
            if(!iq || (iq.getType() == 'error'))
                return;
            
            // IQ received, get some values
            var from = fullXID(getStanzaFrom(iq));
            var query = iq.getQuery();
            
            // Generate the CAPS-processing values
            var identities = new Array();
            var features = new Array();
            var data_forms = new Array();
            
            // Identity values
            $(query).find('identity').each(function() {
                var pCategory = $(this).attr('category');
                var pType = $(this).attr('type');
                var pLang = $(this).attr('xml:lang');
                var pName = $(this).attr('name');
                
                if(!pCategory)
                    pCategory = '';
                if(!pType)
                    pType = '';
                if(!pLang)
                    pLang = '';
                if(!pName)
                    pName = '';
                
                identities.push(pCategory + '/' + pType + '/' + pLang + '/' + pName);
            });
            
            // Feature values
            $(query).find('feature').each(function() {
                var pVar = $(this).attr('var');
                
                // Add the current value to the array
                if(pVar)
                    features.push(pVar);
            });
            
            // Data-form values
            $(query).find('x[xmlns="' + NS_XDATA + '"]').each(function() {
                // Initialize some stuffs
                var pString = '';
                var sortVar = new Array();
                
                // Add the form type field
                $(this).find('field[var="FORM_TYPE"] value').each(function() {
                    var cText = $(this).text();
                    
                    if(cText)
                        pString += cText + '<';
                });
                
                // Add the var attributes into an array
                $(this).find('field:not([var="FORM_TYPE"])').each(function() {
                    var cVar = $(this).attr('var');
                    
                    if(cVar)
                        sortVar.push(cVar);
                });
                
                // Sort the var attributes
                sortVar = sortVar.sort();
                
                // Loop this sorted var attributes
                for(i in sortVar) {
                    // Initialize the value sorting
                    var sortVal = new Array();
                    
                    // Append it to the string
                    pString += sortVar[i] + '<';
                    
                    // Add each value to the array
                    $(this).find('field[var=' + sortVar[i] + '] value').each(function() {
                        sortVal.push($(this).text());
                    });
                    
                    // Sort the values
                    sortVal = sortVal.sort();
                    
                    // Append the values to the string
                    for(j in sortVal)
                        pString += sortVal[j] + '<';
                }
                
                // Any string?
                if(pString) {
                    // Remove the undesired double '<' from the string
                    if(pString.match(/(.+)(<)+$/))
                        pString = pString.substring(0, pString.length - 1);
                    
                    // Add the current string to the array
                    data_forms.push(pString);
                }
            });
            
            // Process the CAPS
            var caps = processCaps(identities, features, data_forms);
            
            // Get the XML string
            var xml = xmlToString(query);
            
            // Store the disco infos
            setPersistent('global', 'caps', caps, xml);
            
            // This is our server
            if(from == getServer()) {
                // Handle the features
                handleFeatures(xml);
                
                Console.info('Got our server CAPS');
            }
            
            else {
                // Display the disco infos
                displayDiscoInfos(from, xml);
                
                Console.info('Got CAPS: ' + from);
            }
        } catch(e) {
            Console.error('Caps.handleDiscoInfos', e);
        }

    };


    /**
     * Displays the disco#infos everywhere needed for an entity
     * @public
     * @param {string} from
     * @param {string} xml
     * @return {undefined}
     */
    self.displayDiscoInfos = function(from, xml) {

        try {
            // Generate the chat path
            var xid = bareXID(from);
            
            // This comes from a private groupchat chat?
            if(isPrivate(xid))
                xid = from;
            
            hash = hex_md5(xid);

            // Display the supported features
            var features = {}

            $(xml).find('feature').each(function() {
                var current = $(this).attr('var');

                if(current) {
                    features[current] = 1;
                }
            });
            
            // Paths
            var path = $('#' + hash);
            var message_area = path.find('.message-area');
            var style = path.find('.chat-tools-style');
            var file = path.find('.chat-tools-file');
            
            // Apply xHTML-IM
            if(NS_XHTML_IM in features) {
                style.show();
            } else {
                // Remove the tooltip elements
                style.hide();
                style.find('.bubble-style').remove();
                
                // Reset the markers
                message_area.removeAttr('style')
                        .removeAttr('data-font')
                        .removeAttr('data-fontsize')
                        .removeAttr('data-color')
                        .removeAttr('data-bold')
                        .removeAttr('data-italic')
                        .removeAttr('data-underline');
            }
            
            // Apply Out of Band Data
            if(NS_IQOOB in features || NS_XOOB in features) {
                file.show();
                
                // Set a marker
                file.attr(
                    'data-oob',
                    NS_IQOOB in features ? 'iq' : 'x'
                );
            }
            
            else {
                // Remove the tooltip elements
                file.hide();
                file.find('.bubble-style').remove();
                
                // Reset the marker
                file.removeAttr('data-oob');
            }
            
            // Apply receipts
            if(NS_URN_RECEIPTS in features) {
                message_area.attr('data-receipts', 'true');
            } else {
                message_area.removeAttr('data-receipts');
            }
        } catch(e) {
            Console.error('Caps.displayDiscoInfos', e);
        }

    };


    /**
     * Generates the CAPS hash
     * @public
     * @param {object} cIdentities
     * @param {object} cFeatures
     * @param {object} cDataForms
     * @return {string}
     */
    self.processCaps = function(cIdentities, cFeatures, cDataForms) {

        try {
            // Initialize
            var cString = '';
            
            // Sort the arrays
            cIdentities = cIdentities.sort();
            cFeatures = cFeatures.sort();
            cDataForms = cDataForms.sort();
            
            // Process the sorted identity string
            for(a in cIdentities) {
                cString += cIdentities[a] + '<';
            }
            
            // Process the sorted feature string
            for(b in cFeatures) {
                cString += cFeatures[b] + '<';
            }
            
            // Process the sorted data-form string
            for(c in cDataForms) {
                cString += cDataForms[c] + '<';
            }
            
            // Process the SHA-1 hash
            var cHash = b64_sha1(cString);
            
            return cHash;
        } catch(e) {
            Console.error('Caps.process', e);
        }

    };


	/**
     * Generates the Jappix CAPS hash
     * @public
     * @return {string}
     */
    self.my = function() {

        try {
            return processCaps(
                new Array('client/web//Jappix'),
                myDiscoInfos(),
                new Array()
            );
        } catch(e) {
            Console.error('Caps.my', e);
        }

    };


    /**
     * Return class scope
     */
    return self;

})();