export type ProjectedClaim={claimType:"employment"|"education"|"project"|"skill"|"certification"|"language"|"logistics"|"other";label:string;value:string;section:string;excerpt:string;confidence:number};
const skills=["TypeScript","JavaScript","Python","Java","Go","Node.js","React","Next.js","PostgreSQL","MySQL","MongoDB","Redis","Kafka","AWS","Docker","Kubernetes","GraphQL"];
export function projectEvidence(markdown:string):ProjectedClaim[]{
  const text=markdown.replace(/\s+/g," ").trim(); if(!text)return [];
  const claims:ProjectedClaim[]=[];
  for(const skill of skills){const match=text.match(new RegExp(`\\b${skill.replace(".","\\.")}\\b`,"i"));if(match){const start=Math.max(0,(match.index??0)-70);claims.push({claimType:"skill",label:"Skill",value:skill,section:"CV text",excerpt:text.slice(start,start+180),confidence:.88})}}
  const lines=markdown.split(/\n+/).map(v=>v.replace(/^#+\s*/,"").trim()).filter(v=>v.length>12&&v.length<220);
  const employment=lines.find(v=>/(engineer|developer|architect|manager).*(at|@)|experience/i.test(v));
  if(employment)claims.push({claimType:"employment",label:"Employment evidence",value:employment,section:"Experience",excerpt:employment,confidence:.76});
  const project=lines.find(v=>/project|built|developed|designed|implemented/i.test(v));
  if(project)claims.push({claimType:"project",label:"Project evidence",value:project,section:"Projects / experience",excerpt:project,confidence:.72});
  const education=lines.find(v=>/(bachelor|master|b\.tech|m\.tech|university|college)/i.test(v));
  if(education)claims.push({claimType:"education",label:"Education",value:education,section:"Education",excerpt:education,confidence:.82});
  const ownership=lines.find(v=>/\b(mentored|managed|led|owned|ownership|incident reviews?|reliability improvements?)\b/i.test(v));
  if(ownership&&ownership!==employment&&ownership!==project)claims.push({claimType:"employment",label:"Technical ownership",value:ownership,section:"Experience",excerpt:ownership,confidence:.78});
  const notice=text.match(/\b(?:notice period(?: is)?|available (?:in|after)|joining (?:in|after))\s*(?:of\s*)?(\d{1,3})\s*days?\b/i);
  if(notice)claims.push({claimType:"logistics",label:"Notice period",value:`${notice[1]} days`,section:"Availability",excerpt:text.slice(Math.max(0,(notice.index??0)-40),Math.min(text.length,(notice.index??0)+notice[0].length+80)),confidence:.9});
  return claims.slice(0,30);
}
