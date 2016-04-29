(function ($) {
    var idle_status = '';
    change_idle('Initial');

    $( document ).on( "idle.idleTimer", function(event, elem, obj){
        change_idle('idle');
    });
    
    $( document ).on( "active.idleTimer", function(event, elem, obj, triggerevent){
        change_idle('active');
    });

    change_idle('Timer Active');

    function change_idle(idle_state){
        idle_status=idle_state;
        parent.postMessage('idle_status:' + idle_status, '*');
    };

    $.idleTimer(3000);

    respondToIdleStatus = function(e) {
        
        // if (e.origin == '*') {
            // e.data is the string sent by the origin with postMessage. 
            if (e.data == 'ruidle?') {
                parent.postMessage('idle_status:' + idle_status, '*');
            }
        // }
    }
    
    window.addEventListener('message', respondToIdleStatus, false);
    
})(jQuery);
