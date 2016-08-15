<?php

//message queue test

$qid = 392089;
$seq = msg_get_queue($qid);

$payload = 'Test from PHP';
msg_send($seq, 12, $payload, false);

$q_stat = msg_stat_queue($seq);
print_r($q_stat);

$status_receive = msg_receive($seq , 12 , $msgtype , 9999999 , $message );

print_r($status_receive);
print_r($msgtype);
print_r($message);