'use strict';

/**
 * Process a property that is held for sale
 * @param {com.ibm.homechain.RegisterPropertyForSale} tx the transaction object
 * @return {Promise} Asset Registry Promise
 * @transaction
 */
function onRegisterPropertyForSale(tx) {
    console.log('### onRegisterPropertyForSale ' + tx.toString());
    tx.property.status = 'FOR_SALE';

    return getAssetRegistry('com.ibm.homechain.Property').then(function (result) {
        return result.update(tx.property);
    }).then(function () {
        var event = getFactory().newEvent('com.ibm.homechain', 'ForSaleEvent');
        event.property = tx.property;
        event.seller = tx.seller;
        emit(event);
    });
}

function onApplyForMortgage(tx) {
    console.log('### mortgageApplication ' + tx.toString());
    var applicant = tx.applicant;

    if (tx.applicant.mortgage && tx.applicant.mortgage.status === 'PENDING') {
        throw new Error('Existing application in progress');
    }

    if (!applicant.mortgage) {
        applicant.mortgage = getFactory().newConcept('com.ibm.homechain', 'Mortgage');
    }

    applicant.mortgage.status = 'PENDING';
    applicant.mortgage.bank = tx.bank;

    return getParticipantRegistry('com.ibm.homechain.Person').then(function (result) {
        return result.update(applicant);
    }).then(function () {
        var event = getFactory().newEvent('com.ibm.homechain', 'MortgageApplication');
        event.applicant = tx.applicant;
        event.bank = tx.bank;
        emit(event);
    });
}

function onApproveMortgageInPrinciple(tx) {
    console.log('### mortgageApproval ' + tx.toString());
    var applicant = tx.applicant;

    if (!(applicant.mortgage && applicant.mortgage.status === 'PENDING')) {
        throw new Error('Must apply for mortgage first');
    }

    applicant.mortgage.status = 'IN_PRINCIPLE';
    applicant.mortgage.amount = tx.amount;

    return getParticipantRegistry('com.ibm.homechain.Person').then(function(result) {
        return result.update(applicant);
    }).then(function() {
        var event = getFactory().newEvent('com.ibm.homechain', 'MortgageApprovalInPrinciple');
        event.amount = tx.amount;
        event.applicant = applicant;
        event.bank = tx.applicant.mortgage.bank;
        emit(event);
    });
}

function onRejectMortgage(tx) {
    console.log('### mortgageRejection ' + tx.toString());
    var applicant = tx.applicant;

    if (!(applicant.mortgage && applicant.mortgage.status === 'PENDING')) {
        throw new Error('Must apply for mortgage first');
    }

    applicant.mortgage.status = 'REJECTED';

    return getParticipantRegistry('com.ibm.homechain.Person').then(function(result) {
        return result.update(applicant);
    }).then(function() {
        var event = getFactory().newEvent('com.ibm.homechain', 'MortgageRejection');
        event.applicant = applicant;
        event.bank = tx.applicant.mortgage.bank;
        emit(event);
    });
}

function onMakeOfferOnProperty(tx) {
    console.log('### makeOfferOnProperty ' + tx.toString());
    var buyer = tx.buyer;
    var property = tx.property;

    if (!(buyer.mortgage && buyer.mortgage.status === 'IN_PRINCIPLE')) {
        throw new Error('Must get funding first');
    }
    if (tx.amount > buyer.mortgage.amount) {
        throw new Error('Cannot make an offer greater than funding amount');
    }
    if (property.status !== 'FOR_SALE') {
        throw new Error('Property must be for sale');
    }

    var offer = getFactory().newConcept('com.ibm.homechain', 'Offer');
    offer.amount = tx.amount;
    offer.buyer = tx.buyer;
    offer.accepted = false;

    if (!property.offers) {
        offer.id = '1';
        property.offers = [offer];
    } else {
        offer.id = (property.offers.length + 1).toString();
        property.offers.push(offer);
    }

    return getAssetRegistry('com.ibm.homechain.Property').then(function (result) {
        return result.update(property);
    }).then(function() {
        var event = getFactory().newEvent('com.ibm.homechain', 'OfferOnProperty');
        event.id = offer.id;
        event.amount = tx.amount;
        event.buyer = tx.buyer;
        event.property = tx.property;
        emit(event);
    });
}

function onAcceptOfferOnProperty(tx) {
    console.log('### acceptOfferOnProperty ' + tx.toString());
    var property = tx.property;
    var offer = tx.property.offers.find(function(i) { return i.id === tx.offerId; });
    
    if (property.status !== 'FOR_SALE') {
        throw new Error('Property must be for sale');
    }
    
    property.status = 'SOLD_STC';
    offer.accepted = true;
    
    return getAssetRegistry('com.ibm.homechain.Property').then(function (result) {
        return result.update(property);
    }).then(function() {
        var event = getFactory().newEvent('com.ibm.homechain', 'OfferOnPropertyAccepted');
        event.offerId = offer.id;
        event.amount = offer.amount;
        event.buyer = offer.buyer;
        event.property = tx.property;
        emit(event);
    });
}

function onPerformSurvey(tx) {
    console.log('### performSurvey ' + tx.toString());
    var property = tx.property;

    property.surveyPerformed = true;

    return getAssetRegistry('com.ibm.homechain.Property').then(function(result) {
        return result.update(property);
    }).then(function() {
        var event = getFactory().newEvent('com.ibm.homechain', 'SurveyPerformed');
        event.property = property;
        emit(event);
    });
}

function onProvideInsurance(tx) {
    console.log('### provideInsurance ' + tx.toString());
    var property = tx.property;

    property.insurance = true;

    return getAssetRegistry('com.ibm.homechain.Property').then(function(result) {
        return result.update(property);
    }).then(function() {
        var event = getFactory().newEvent('com.ibm.homechain', 'InsuranceProvided');
        event.property = property;
        emit(event);
    });
}

function onApproveMortgage(tx) {
    console.log('### approveMortgage ' + tx.toString());
    var property = tx.property;
    var offers = property.offers;
    var acceptedOffer = null;
    var applicant = null;
    
    if (!(property.offers)) {
        throw new Error('Property must have offers');
    }

    for (var i = 0; i < offers.length; i++) {
        if (offers[i].accepted) {
            acceptedOffer = offers[i];
            break;
        }
    }

    if (!acceptedOffer) {
        throw new Error('Property must have accepted offer');
    }

    applicant = acceptedOffer.buyer;

    if (!(applicant.mortgage && applicant.mortgage.status === 'IN_PRINCIPLE')) {
        throw new Error('Must have in principle mortgage before full approval');
    }

    applicant.mortgage.status = 'APPROVED';
    applicant.mortgage.amount = acceptedOffer.amount;

    return getParticipantRegistry('com.ibm.homechain.Person').then(function(result) {
        return result.update(applicant);
    }).then(function() {
        var event = getFactory().newEvent('com.ibm.homechain', 'MortgageApproved');
        event.amount = acceptedOffer.amount;
        event.buyer = applicant;
        event.property = property;
        emit(event);
    });
}

/**
 * Process the sale of a property
 * @param {com.ibm.homechain.PropertySale} tx the transaction information
 * @return {Promise} Asset Registry Promise
 * @transaction
 */
function onPropertySale(tx) {
    console.log('### onPropertySale ' + tx.toString());
    var property = tx.property;
    var acceptedOffer = {};

    for (var i = 0; i < property.offers.length; i++) {
        if (property.offers[i].accepted === true) {
            acceptedOffer = property.offers[i];
            break;
        }
    }

    if (property.status !== 'SOLD_STC') {
        throw new Error('Property must be sold stc');
    }
    if (!property.surveyPerformed) {
        throw new Error('Survey must be performed');
    }
    if (!property.insurance) {
        throw new Error('Insurance must be present');
    }
    if (acceptedOffer.buyer.mortgage.status !== 'APPROVED') {
        throw new Error('Mortgage must be approved before sale');
    }

    property.status = 'NA';
    property.owner = acceptedOffer.buyer;

    return getAssetRegistry('com.ibm.homechain.Property').then(function (result) {
        return result.update(property);
    }).then(function () {
        var event = getFactory().newEvent('com.ibm.homechain', 'SaleEvent');
        event.property = tx.property;
        event.buyer = property.owner;
        event.price = acceptedOffer.amount;
        emit(event);
    });
}


// ------ ONLY FOR DEMO PURPOSES -------
/**
 *
 * @param {com.ibm.homechain.SeedData} seedData
 * @transaction
 */
function seedData(seedData) {
    var factory = getFactory();
    var NS = 'com.ibm.homechain';

    var persons = [
        factory.newResource(NS, 'Person', 'PERSON_1'),
        factory.newResource(NS, 'Person', 'PERSON_2'),
        factory.newResource(NS, 'Person', 'PERSON_3'),
        factory.newResource(NS, 'Person', 'PERSON_4')
    ];

    var firstNames = ['Alice', 'Bob', 'Carol', 'Raj'];
    var lastNames = ['Smith', 'Jones', 'Watson', 'Gupta'];

    var estateAgents = [
        factory.newResource(NS, 'EstateAgent', 'AGENT_1'),
        factory.newResource(NS, 'EstateAgent', 'AGENT_2')
    ];

    var banks = [
        factory.newResource(NS, 'Bank', 'BANK_1'),
        factory.newResource(NS, 'Bank', 'BANK_2')
    ];

    var surveyors = [
        factory.newResource(NS, 'Surveyor', 'SURVEYOR_1'),
    ];

    var insurers = [
        factory.newResource(NS, 'Insurer', 'INSURER_1'),
    ];

    var properties = [
        factory.newResource(NS, 'Property', 'PROPERTY_1'),
        factory.newResource(NS, 'Property', 'PROPERTY_2'),
        factory.newResource(NS, 'Property', 'PROPERTY_3'),
        factory.newResource(NS, 'Property', 'PROPERTY_4'),
        factory.newResource(NS, 'Property', 'PROPERTY_5')
    ];

    return getParticipantRegistry(NS + '.Regulator')
        .then(function (regulatorRegistry) {
            var regulator = factory.newResource(NS, 'Regulator', 'REGULATOR');
            regulator.email = 'regulator@email.com';
            return regulatorRegistry.addAll([regulator]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.LandRegistry');
        })
        .then(function (landRegRegistry) {
            var landreg = factory.newResource(NS, 'LandRegistry', 'LAND_REGISTRY');
            landreg.email = 'landreg@email.com';
            return landRegRegistry.addAll([landreg]);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.Person');
        })
        .then(function (personRegistry) {
            persons.forEach(function (person, index) {
                person.firstName = firstNames[index];
                person.lastName = lastNames[index];
                person.email = person.getIdentifier() + '@email.com';
            });
            return personRegistry.addAll(persons);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.EstateAgent');
        })
        .then(function (estateAgentRegistry) {
            estateAgents.forEach(function (estateAgent, index) {
                estateAgent.email = estateAgent.getIdentifier() + '@email.com';
                estateAgent.businessName = 'BUSINESS_' + (index + 1);
                estateAgent.companyNumber = Math.floor((Math.random() * 10000000) + 1).toString();
            });

            return estateAgentRegistry.addAll(estateAgents);
        })
        .then(function () {
            return getParticipantRegistry(NS + '.Bank');
        })
        .then(function (bankRegistry) {
            banks.forEach(function (bank, index) {
                bank.name = bank.getIdentifier();
            });

            return bankRegistry.addAll(banks);
        })
        .then(function() {
            return getParticipantRegistry(NS + '.Surveyor');
        })
        .then(function(surveyorsRegistry) {
            surveyors.forEach(function(surveyor, index) {
                surveyor.name = surveyor.getIdentifier();
            });

            return surveyorsRegistry.addAll(surveyors);
        })
        .then(function() {
            return getParticipantRegistry(NS + '.Insurer');
        })
        .then(function(insurersRegistry) {
            insurers.forEach(function(insurer, index) {
                insurer.name = insurer.getIdentifier();
            });

            return insurersRegistry.addAll(insurers);
        })
        .then(function () {
            return getAssetRegistry(NS + '.Property');
        })
        .then(function (propertyRegistry) {
            properties.forEach(function (property, index) {
                var owner = 'PERSON_' + ((index % 2) + 1);
                property.address1 = (index + 1) + ' New Road';
                property.address2 = 'London';
                property.county = 'London';
                property.postcode = 'AB12 3CD';
                property.bedrooms = Math.floor((Math.random() * 5) + 1);
                property.status = 'NA';
                property.owner = factory.newRelationship(NS, 'Person', owner);
                property.surveyPerformed = false;
                property.insurance = false;
            });
            return propertyRegistry.addAll(properties);
        });
}